const DEFAULT_CONFIG = {
  rewardedAdUnitId: '',
  interstitialAdUnitId: '',
  bannerAdUnitId: '',
  cooldownMs: 30000,
  interstitialCooldownMs: 90000,
  interstitialEveryLevels: 5,
  dailyRewardLimit: 20,
  mockDelayMs: 120
};

class AdManager {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
    this.wxApi = options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.events = {};
    this.rewardedAd = null;
    this.interstitialAd = null;
    this.bannerAd = null;
    this.lastShownAt = {};
    this.dailyCounts = {};
    this.fillStats = {};
    this.mock = options.mock !== undefined ? options.mock : !this.wxApi;
    if (!this.mock && this.config.rewardedAdUnitId) {
      this.initRewardedVideo(this.config.rewardedAdUnitId);
    }
    if (!this.mock && this.config.interstitialAdUnitId) {
      this.initInterstitial(this.config.interstitialAdUnitId);
    }
    if (!this.mock && this.config.bannerAdUnitId) {
      this.createBanner();
    }
  }

  on(eventName, handler) {
    if (!this.events[eventName]) this.events[eventName] = [];
    this.events[eventName].push(handler);
  }

  off(eventName, handler) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter((item) => item !== handler);
  }

  emit(eventName, payload) {
    (this.events[eventName] || []).forEach((handler) => handler(payload));
  }

  now() {
    return Date.now();
  }

  getDayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  getReasonCount(reason) {
    const dayKey = this.getDayKey();
    const key = `${dayKey}:${reason}`;
    return this.dailyCounts[key] || 0;
  }

  addReasonCount(reason) {
    const dayKey = this.getDayKey();
    const key = `${dayKey}:${reason}`;
    this.dailyCounts[key] = (this.dailyCounts[key] || 0) + 1;
  }

  recordFill(adType, success, reason = '') {
    if (!this.fillStats[adType]) {
      this.fillStats[adType] = { attempts: 0, success: 0, fail: 0, lastReason: '' };
    }
    this.fillStats[adType].attempts += 1;
    if (success) this.fillStats[adType].success += 1;
    else this.fillStats[adType].fail += 1;
    this.fillStats[adType].lastReason = reason;
    return this.getFillStats(adType);
  }

  getFillStats(adType = null) {
    const stats = adType ? { [adType]: this.fillStats[adType] || { attempts: 0, success: 0, fail: 0, lastReason: '' } } : this.fillStats;
    const result = {};
    Object.keys(stats).forEach((key) => {
      const item = stats[key] || {};
      const attempts = item.attempts || 0;
      result[key] = {
        attempts,
        success: item.success || 0,
        fail: item.fail || 0,
        fillRate: attempts ? Math.round(((item.success || 0) / attempts) * 100) : 0,
        lastReason: item.lastReason || ''
      };
    });
    return adType ? result[adType] : result;
  }

  canShowRewarded(reason = 'reward') {
    const elapsed = this.now() - (this.lastShownAt[reason] || 0);
    if (elapsed < this.config.cooldownMs) {
      return { ok: false, reason: 'cooldown', remainingMs: this.config.cooldownMs - elapsed };
    }
    if (this.getReasonCount(reason) >= this.config.dailyRewardLimit) {
      return { ok: false, reason: 'dailyLimit', remainingMs: 0 };
    }
    return { ok: true, reason: 'ready', remainingMs: 0 };
  }

  initRewardedVideo(adUnitId = this.config.rewardedAdUnitId) {
    this.config.rewardedAdUnitId = adUnitId;
    if (this.mock || !this.wxApi || !this.wxApi.createRewardedVideoAd || !adUnitId) {
      this.rewardedAd = null;
      return null;
    }
    this.rewardedAd = this.wxApi.createRewardedVideoAd({ adUnitId });
    if (this.rewardedAd.onError) {
      this.rewardedAd.onError((error) => this.emit('rewarded.error', error));
    }
    return this.rewardedAd;
  }

  showRewardedVideo(reason = 'reward') {
    const gate = this.canShowRewarded(reason);
    if (!gate.ok) {
      return Promise.resolve({ success: false, source: this.mock ? 'mock' : 'wx', reason: gate.reason, remainingMs: gate.remainingMs });
    }

    if (this.mock || !this.rewardedAd) {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.lastShownAt[reason] = this.now();
          this.addReasonCount(reason);
          this.recordFill('rewarded', true, reason);
          const payload = { success: true, source: 'mock', reason };
          this.emit('rewarded.close', payload);
          resolve(payload);
        }, this.config.mockDelayMs);
      });
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (payload) => {
        if (resolved) return;
        resolved = true;
        if (this.rewardedAd.offClose) this.rewardedAd.offClose(onClose);
        if (payload.success) {
          this.lastShownAt[reason] = this.now();
          this.addReasonCount(reason);
        }
        this.recordFill('rewarded', payload.success, payload.reason || reason);
        this.emit('rewarded.close', payload);
        resolve(payload);
      };
      const onClose = (res) => {
        finish({
          success: Boolean(res && (res.isEnded || res.isEnded === undefined)),
          source: 'wx',
          reason
        });
      };
      if (this.rewardedAd.onClose) this.rewardedAd.onClose(onClose);
      const showPromise = this.rewardedAd.show ? this.rewardedAd.show() : Promise.reject(new Error('Rewarded ad unavailable'));
      showPromise.catch(() => {
        if (!this.rewardedAd.load) {
          finish({ success: false, source: 'wx', reason: 'loadFailed' });
          return Promise.resolve();
        }
        return this.rewardedAd.load()
          .then(() => this.rewardedAd.show())
          .catch((error) => {
            this.emit('rewarded.error', error);
            finish({ success: false, source: 'wx', reason: 'loadFailed', error });
          });
      });
    });
  }

  requestReward(reason = 'reward') {
    return this.showRewardedVideo(reason);
  }

  requestDoubleScore() {
    return this.showRewardedVideo('double_score');
  }

  requestRevive() {
    return this.showRewardedVideo('revive');
  }

  initInterstitial(adUnitId = this.config.interstitialAdUnitId) {
    this.config.interstitialAdUnitId = adUnitId;
    if (this.mock || !this.wxApi || !this.wxApi.createInterstitialAd || !adUnitId) return null;
    this.interstitialAd = this.wxApi.createInterstitialAd({ adUnitId });
    return this.interstitialAd;
  }

  showInterstitial(reason = 'betweenLevels') {
    if (this.mock || !this.interstitialAd || !this.interstitialAd.show) {
      this.lastShownAt.interstitial = this.now();
      this.recordFill('interstitial', true, reason);
      return Promise.resolve({ success: true, source: 'mock', reason });
    }
    return this.interstitialAd.show()
      .then(() => {
        this.lastShownAt.interstitial = this.now();
        this.recordFill('interstitial', true, reason);
        return { success: true, source: 'wx', reason };
      })
      .catch((error) => {
        this.recordFill('interstitial', false, reason);
        return { success: false, source: 'wx', reason, error };
      });
  }

  canShowInterstitialAfterLevel(levelId) {
    const normalized = Number(levelId || 0);
    if (!normalized || normalized % this.config.interstitialEveryLevels !== 0) {
      return { ok: false, reason: 'notScheduled' };
    }
    const elapsed = this.now() - (this.lastShownAt.interstitial || 0);
    if (elapsed < this.config.interstitialCooldownMs) {
      return { ok: false, reason: 'cooldown', remainingMs: this.config.interstitialCooldownMs - elapsed };
    }
    return { ok: true, reason: 'ready' };
  }

  showInterstitialAfterLevel(levelId) {
    const gate = this.canShowInterstitialAfterLevel(levelId);
    if (!gate.ok) {
      return Promise.resolve({ success: false, source: this.mock ? 'mock' : 'wx', reason: gate.reason, remainingMs: gate.remainingMs || 0 });
    }
    return this.showInterstitial(`level_${levelId}_complete`);
  }

  createBanner(style = {}, adUnitId = this.config.bannerAdUnitId) {
    this.config.bannerAdUnitId = adUnitId;
    if (this.mock || !this.wxApi || !this.wxApi.createBannerAd || !adUnitId) {
      this.bannerAd = null;
      return null;
    }
    this.bannerAd = this.wxApi.createBannerAd({ adUnitId, style });
    return this.bannerAd;
  }

  showBanner() {
    if (this.mock || !this.bannerAd || !this.bannerAd.show) {
      this.recordFill('banner', true, 'show');
      return Promise.resolve({ success: true, source: 'mock' });
    }
    return this.bannerAd.show()
      .then(() => {
        this.recordFill('banner', true, 'show');
        return { success: true, source: 'wx' };
      })
      .catch((error) => {
        this.recordFill('banner', false, 'show');
        return { success: false, source: 'wx', error };
      });
  }

  showResultBanner(view = {}) {
    if (!this.bannerAd && this.config.bannerAdUnitId) {
      const width = Math.min(320, view.width || 320);
      const top = Math.max(0, (view.height || 667) - 96);
      this.createBanner({ left: Math.max(0, ((view.width || width) - width) / 2), top, width });
    }
    return this.showBanner();
  }

  hideBanner() {
    if (this.bannerAd && this.bannerAd.hide) this.bannerAd.hide();
  }
}

module.exports = AdManager;
