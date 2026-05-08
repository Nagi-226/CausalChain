const ITEM_IDS = ['freeze', 'reveal', 'undo', 'shuffle'];

const DEFAULT_LIMITS = {
  freeze: 1,
  reveal: 1,
  undo: 2,
  shuffle: 1
};

const DEFAULT_INVENTORY = {
  freeze: 1,
  reveal: 1,
  undo: 1,
  shuffle: 1
};

const DEFAULT_CAPS = {
  freeze: 5,
  reveal: 5,
  undo: 6,
  shuffle: 4
};

const DEFAULT_ECONOMY = {
  freeGrantEveryLevels: {
    reveal: 3,
    undo: 5,
    shuffle: 8
  },
  dailyChallengeReward: {
    reveal: 1,
    undo: 1
  }
};

class ItemManager {
  constructor(options = {}) {
    this.adManager = options.adManager || null;
    this.itemIds = options.itemIds || ITEM_IDS;
    this.inventory = { ...DEFAULT_INVENTORY, ...(options.inventory || {}) };
    this.levelLimits = { ...DEFAULT_LIMITS, ...(options.levelLimits || {}) };
    this.inventoryCaps = { ...DEFAULT_CAPS, ...(options.inventoryCaps || {}) };
    this.economy = mergeEconomy(DEFAULT_ECONOMY, options.economy || {});
    this.perLevelUsed = {};
    this.currentLevelId = null;
    this.effects = {
      freeze: { durationMs: 1 },
      reveal: { durationMs: 3000 },
      undo: {},
      shuffle: { preserveSolvable: true }
    };
  }

  startLevel(levelId, options = {}) {
    this.currentLevelId = levelId;
    this.perLevelUsed = {};
    return this.applyLevelGrants(levelId, options || {});
  }

  setAdManager(adManager) {
    this.adManager = adManager;
  }

  setInventory(inventory = {}) {
    inventory = inventory || {};
    this.inventory = { ...this.inventory, ...inventory };
  }

  getInventory() {
    return { ...this.inventory };
  }

  getPerLevelUsed() {
    return { ...this.perLevelUsed };
  }

  getRemainingUses(itemId) {
    const limit = this.levelLimits[itemId] || 0;
    const used = this.perLevelUsed[itemId] || 0;
    return Math.max(0, limit - used);
  }

  canUseItem(itemId) {
    if (!this.itemIds.includes(itemId)) return { ok: false, reason: 'unknownItem' };
    if (this.getRemainingUses(itemId) <= 0) return { ok: false, reason: 'levelLimit' };
    return { ok: true, reason: 'ready' };
  }

  grantItem(itemId, amount = 1) {
    if (!this.itemIds.includes(itemId)) return false;
    const cap = this.inventoryCaps[itemId] || Infinity;
    this.inventory[itemId] = Math.min(cap, (this.inventory[itemId] || 0) + Math.max(0, amount));
    return true;
  }

  grantItems(items = {}) {
    items = items || {};
    const granted = {};
    Object.keys(items).forEach((itemId) => {
      if (this.grantItem(itemId, items[itemId])) {
        granted[itemId] = Number(items[itemId] || 0);
      }
    });
    return granted;
  }

  applyLevelGrants(levelId, options = {}) {
    options = options || {};
    const grants = {};
    const explicit = options.grants && (options.grants.items || options.grants);
    if (explicit) {
      Object.keys(explicit).forEach((itemId) => {
        if (this.itemIds.includes(itemId)) grants[itemId] = (grants[itemId] || 0) + Number(explicit[itemId] || 0);
      });
    }
    Object.keys(this.economy.freeGrantEveryLevels || {}).forEach((itemId) => {
      const interval = Number(this.economy.freeGrantEveryLevels[itemId] || 0);
      if (interval > 0 && Number(levelId) > 0 && Number(levelId) % interval === 0) {
        grants[itemId] = (grants[itemId] || 0) + 1;
      }
    });
    return this.grantItems(grants);
  }

  claimDailyChallengeReward(reward = this.economy.dailyChallengeReward) {
    return this.grantItems(reward || {});
  }

  requestAdItem(itemId, amount = 1) {
    if (!this.itemIds.includes(itemId)) {
      return Promise.resolve({ success: false, itemId, reason: 'unknownItem' });
    }
    if (!this.adManager || typeof this.adManager.requestReward !== 'function') {
      return Promise.resolve({ success: false, itemId, reason: 'missingAdManager' });
    }
    return this.adManager.requestReward(`item.${itemId}`).then((adResult) => {
      if (!adResult.success) return { success: false, itemId, reason: 'adNotCompleted', adResult };
      this.grantItem(itemId, amount);
      return { success: true, itemId, amount, inventory: this.getInventory(), adResult };
    });
  }

  consumeItem(itemId) {
    if ((this.inventory[itemId] || 0) <= 0) return false;
    this.inventory[itemId] -= 1;
    this.perLevelUsed[itemId] = (this.perLevelUsed[itemId] || 0) + 1;
    return true;
  }

  callAdapter(adapter, methodName, payload) {
    if (!adapter || typeof adapter[methodName] !== 'function') {
      return { success: false, reason: 'missingAdapter', methodName };
    }
    const value = adapter[methodName](payload);
    if (value && typeof value.then === 'function') return value;
    return { success: value !== false, value };
  }

  applyEffect(itemId, adapter, context = {}) {
    if (itemId === 'freeze') {
      return this.callAdapter(adapter, 'freezeBacktrack', { ...this.effects.freeze, ...context });
    }
    if (itemId === 'reveal') {
      return this.callAdapter(adapter, 'revealPath', { ...this.effects.reveal, ...context });
    }
    if (itemId === 'undo') {
      return this.callAdapter(adapter, 'undoLastMove', { ...this.effects.undo, ...context });
    }
    if (itemId === 'shuffle') {
      return this.callAdapter(adapter, 'shuffleBoard', { ...this.effects.shuffle, ...context });
    }
    return { success: false, reason: 'unknownItem' };
  }

  normalizeEffectResult(result) {
    if (result === false) return { success: false, reason: 'effectRejected' };
    if (!result || result.success === undefined) return { success: true, value: result };
    return result;
  }

  useItem(itemId, adapter, options = {}) {
    options = options || {};
    const gate = this.canUseItem(itemId);
    if (!gate.ok) return Promise.resolve({ success: false, itemId, reason: gate.reason });

    const hasInventory = (this.inventory[itemId] || 0) > 0;
    if (!hasInventory && options.allowAd && this.adManager) {
      return this.adManager.requestReward(`item.${itemId}`).then((adResult) => {
        if (!adResult.success) return { success: false, itemId, reason: 'adNotCompleted', adResult };
        this.grantItem(itemId, 1);
        return this.useItem(itemId, adapter, { ...options, allowAd: false, adResult });
      });
    }

    if (!hasInventory) return Promise.resolve({ success: false, itemId, reason: 'noInventory', canWatchAd: Boolean(this.adManager) });
    if (!this.consumeItem(itemId)) return Promise.resolve({ success: false, itemId, reason: 'consumeFailed' });

    const effect = this.applyEffect(itemId, adapter, { levelId: this.currentLevelId, ...(options.context || {}) });
    return Promise.resolve(effect).then((effectResult) => {
      const normalized = this.normalizeEffectResult(effectResult);
      if (!normalized.success) {
        this.inventory[itemId] += 1;
        this.perLevelUsed[itemId] = Math.max(0, (this.perLevelUsed[itemId] || 1) - 1);
        return { ...normalized, itemId };
      }
      return { success: true, itemId, effect: normalized };
    });
  }

  getToolbarState() {
    const adHints = {};
    this.itemIds.forEach((itemId) => {
      adHints[itemId] = Boolean(this.adManager) && (this.inventory[itemId] || 0) <= 0 && this.getRemainingUses(itemId) > 0;
    });
    return {
      inventory: this.getInventory(),
      perLevelUsed: this.getPerLevelUsed(),
      limits: { ...this.levelLimits },
      caps: { ...this.inventoryCaps },
      adHints
    };
  }
}

function mergeEconomy(base, override) {
  return {
    ...base,
    ...override,
    freeGrantEveryLevels: {
      ...(base.freeGrantEveryLevels || {}),
      ...(override.freeGrantEveryLevels || {})
    },
    dailyChallengeReward: {
      ...(base.dailyChallengeReward || {}),
      ...(override.dailyChallengeReward || {})
    }
  };
}

module.exports = ItemManager;
