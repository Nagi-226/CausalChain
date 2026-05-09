const MEMORY_STORAGE = {};

class DailyChallenge {
  constructor(options = {}) {
    this.wx = options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.storageKey = options.storageKey || 'ccgs.dailyChallenge.v0';
    this.cloudFunctionName = options.cloudFunctionName || 'dailyChallenge';
    this.baseLevel = options.baseLevel || {};
    this.cache = this.loadLocal();
  }

  getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async getTodayChallenge(date = new Date()) {
    const dateKey = this.getDateKey(date);
    const cloudChallenge = await this.callCloud('getTodayChallenge', { dateKey }).catch(() => null);
    const challenge = cloudChallenge && cloudChallenge.challenge
      ? cloudChallenge.challenge
      : this.buildLocalChallenge(dateKey);
    this.cache.lastChallenge = challenge;
    this.saveLocal();
    return challenge;
  }

  buildLocalChallenge(dateKey = this.getDateKey()) {
    const hash = hashString(dateKey);
    const difficulty = 4 + (hash % 4);
    const chainLength = 2 + (hash % 2);
    return {
      id: `daily-${dateKey}`,
      levelId: 8000 + Number(dateKey.replace(/-/g, '').slice(-4)),
      dateKey,
      seed: `daily-${dateKey}-${hash}`,
      difficulty,
      fillRate: 0.56 + (hash % 8) / 100,
      minimumSteps: 12 + (hash % 8),
      theme: hash % 2 === 0 ? 'star' : 'ocean',
      board: { width: 8, height: 6 },
      generator: {
        colors: 3,
        icons: 3,
        chainLength,
        relationMode: 'chain',
        guaranteedPairs: 5
      },
      goals: { clearAll: true, moveBudget: 28 },
      rewards: { items: { reveal: 1, undo: 1 } },
      isDailyChallenge: true
    };
  }

  async submitResult(result = {}) {
    const dateKey = result.dateKey || this.getDateKey();
    const record = {
      dateKey,
      playerId: result.playerId || result.openid || 'local-player',
      nickname: result.nickname || 'You',
      moves: Number(result.moves || 0),
      stars: Number(result.stars || 0),
      elapsedMs: Number(result.elapsedMs || 0),
      cleared: result.cleared !== false
    };
    const cloudResult = await this.callCloud('submitResult', record).catch(() => null);
    const localRank = this.saveLocalResult(record);
    return cloudResult || { ok: true, mock: true, rank: localRank, record };
  }

  async getNationalLeaderboard(dateKey = this.getDateKey()) {
    const cloudResult = await this.callCloud('getNationalLeaderboard', { dateKey }).catch(() => null);
    if (cloudResult && Array.isArray(cloudResult.rows)) return cloudResult.rows;
    const rows = this.cache.results && this.cache.results[dateKey] ? this.cache.results[dateKey] : [];
    return rankRows(rows);
  }

  claimReward(itemManager, dateKey = this.getDateKey()) {
    if (!itemManager || typeof itemManager.claimDailyChallengeReward !== 'function') {
      return { success: false, reason: 'missingItemManager' };
    }
    if (this.cache.claimedRewards && this.cache.claimedRewards[dateKey]) {
      return { success: false, reason: 'alreadyClaimed' };
    }
    const challenge = this.cache.lastChallenge && this.cache.lastChallenge.dateKey === dateKey
      ? this.cache.lastChallenge
      : this.buildLocalChallenge(dateKey);
    const granted = itemManager.claimDailyChallengeReward((challenge.rewards && challenge.rewards.items) || undefined);
    this.cache.claimedRewards = this.cache.claimedRewards || {};
    this.cache.claimedRewards[dateKey] = true;
    this.saveLocal();
    return { success: true, granted };
  }

  saveLocalResult(record) {
    this.cache.results = this.cache.results || {};
    const rows = this.cache.results[record.dateKey] || [];
    const next = { ...record, updatedAt: Date.now() };
    const playerKey = getPlayerKey(next);
    const existingIndex = rows.findIndex((item) => getPlayerKey(item) === playerKey);
    if (existingIndex < 0) {
      rows.push(next);
    } else if (isBetterRecord(next, rows[existingIndex])) {
      rows[existingIndex] = next;
    }
    this.cache.results[record.dateKey] = rankRows(rows).slice(0, 50);
    this.saveLocal();
    const row = this.cache.results[record.dateKey].find((item) => getPlayerKey(item) === playerKey);
    return row ? row.rank : this.cache.results[record.dateKey].length;
  }

  callCloud(action, data = {}) {
    if (!this.wx || !this.wx.cloud || typeof this.wx.cloud.callFunction !== 'function') {
      return Promise.reject(new Error('cloud_unavailable'));
    }
    return new Promise((resolve, reject) => {
      this.wx.cloud.callFunction({
        name: this.cloudFunctionName,
        data: { action, ...data },
        success: (response) => resolve(response.result || response),
        fail: reject
      });
    });
  }

  loadLocal() {
    const storage = getStorage(this.wx);
    return storage.get(this.storageKey) || { results: {}, claimedRewards: {} };
  }

  saveLocal() {
    getStorage(this.wx).set(this.storageKey, this.cache);
  }
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function rankRows(rows = []) {
  return rows.slice()
    .sort((a, b) => a.moves - b.moves || b.stars - a.stars || a.elapsedMs - b.elapsedMs)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function getPlayerKey(row = {}) {
  return row.playerId || row.openid || row.nickname || 'local-player';
}

function isBetterRecord(next, previous) {
  if (!previous || !previous.moves) return true;
  if (next.moves && next.moves < previous.moves) return true;
  if (next.moves === previous.moves && next.stars > (previous.stars || 0)) return true;
  if (next.moves === previous.moves && next.stars === (previous.stars || 0) &&
    next.elapsedMs && next.elapsedMs < (previous.elapsedMs || Infinity)) return true;
  return false;
}

function getStorage(wxApi) {
  if (wxApi && wxApi.getStorageSync && wxApi.setStorageSync) {
    return {
      get: (key) => wxApi.getStorageSync(key),
      set: (key, value) => wxApi.setStorageSync(key, value)
    };
  }
  return {
    get: (key) => MEMORY_STORAGE[key],
    set: (key, value) => { MEMORY_STORAGE[key] = value; }
  };
}

module.exports = DailyChallenge;
