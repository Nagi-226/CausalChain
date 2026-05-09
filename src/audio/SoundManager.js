const DEFAULT_SOUNDS = {
  eliminate: 'assets/sounds/eliminate.wav',
  rewind: 'assets/sounds/rewind.wav',
  win: 'assets/sounds/win.wav',
  fail: 'assets/sounds/fail.wav',
  invalid: 'assets/sounds/invalid.wav',
  item: 'assets/sounds/item.wav'
};

class SoundManager {
  constructor(options = {}) {
    this.wxApi = options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.enabled = options.enabled !== false;
    this.volume = clamp01(options.volume === undefined ? 0.72 : options.volume);
    this.manifest = { ...DEFAULT_SOUNDS, ...(options.manifest || {}) };
    this.contexts = {};
    this.stats = {};
    this.preload(options.preload !== false);
  }

  preload(enabled = true) {
    if (!enabled || !this.wxApi || typeof this.wxApi.createInnerAudioContext !== 'function') {
      return false;
    }
    Object.keys(this.manifest).forEach((key) => this.ensureContext(key));
    return true;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.stopAll();
  }

  setVolume(volume) {
    this.volume = clamp01(volume);
    Object.keys(this.contexts).forEach((key) => {
      if (this.contexts[key]) this.contexts[key].volume = this.volume;
    });
  }

  play(name, options = {}) {
    if (!this.enabled) return this.record(name, false, 'disabled');
    const context = this.ensureContext(name);
    if (!context) return this.record(name, false, 'audioUnavailable');
    try {
      if (options.restart !== false && typeof context.stop === 'function') {
        context.stop();
      }
      context.volume = clamp01(options.volume === undefined ? this.volume : options.volume);
      if (typeof context.play === 'function') {
        context.play();
        return this.record(name, true, 'played');
      }
      return this.record(name, false, 'playUnavailable');
    } catch (error) {
      return this.record(name, false, 'playError', error);
    }
  }

  stopAll() {
    Object.keys(this.contexts).forEach((key) => {
      const context = this.contexts[key];
      if (context && typeof context.stop === 'function') {
        try {
          context.stop();
        } catch (error) {
          this.record(key, false, 'stopError', error);
        }
      }
    });
  }

  ensureContext(name) {
    if (this.contexts[name]) return this.contexts[name];
    const src = this.manifest[name];
    if (!src || !this.wxApi || typeof this.wxApi.createInnerAudioContext !== 'function') {
      return null;
    }
    const context = this.wxApi.createInnerAudioContext();
    context.src = src;
    context.volume = this.volume;
    if (typeof context.onError === 'function') {
      context.onError((error) => this.record(name, false, 'loadError', error));
    }
    this.contexts[name] = context;
    return context;
  }

  record(name, success, reason, error) {
    const key = name || 'unknown';
    if (!this.stats[key]) {
      this.stats[key] = { attempts: 0, success: 0, fail: 0, lastReason: '' };
    }
    this.stats[key].attempts += 1;
    if (success) this.stats[key].success += 1;
    else this.stats[key].fail += 1;
    this.stats[key].lastReason = reason || '';
    if (error) this.stats[key].lastError = String(error.message || error);
    return { success, sound: key, reason };
  }

  destroy() {
    Object.keys(this.contexts).forEach((key) => {
      const context = this.contexts[key];
      if (context) {
        try {
          if (typeof context.stop === 'function') context.stop();
          if (typeof context.destroy === 'function') context.destroy();
        } catch (error) {
          // best-effort cleanup
        }
      }
    });
    this.contexts = {};
    this.stats = {};
  }

  getStats() {
    return JSON.parse(JSON.stringify(this.stats));
  }
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(1, number));
}

SoundManager.DEFAULT_SOUNDS = DEFAULT_SOUNDS;

module.exports = SoundManager;
