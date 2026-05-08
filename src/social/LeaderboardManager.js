const MEMORY_STORAGE = {};

class LeaderboardManager {
  constructor(options = {}) {
    this.wx = options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.storageKey = options.storageKey || 'ccgs.leaderboard.v0';
    this.playerName = options.playerName || 'You';
    this.avatarUrl = options.avatarUrl || '';
    this.province = options.province || '';
    this.cache = this.loadLocal();
    this.lastOpenDataMessage = null;
  }

  async submitLevelResult(result = {}) {
    const levelId = Number(result.levelId || 1);
    const moves = Number(result.moves || 0);
    const stars = Number(result.stars || 0);
    const elapsedMs = Number(result.elapsedMs || 0);
    const levelKey = String(levelId);
    const friendBenchmark = await this.getFriendBenchmark(levelId).catch(() => null);
    const previous = this.cache.levels[levelKey] || {};
    const previousRecord = previous.bestMoves ? { ...previous } : null;
    const isPersonalBest = !previous.bestMoves || (moves > 0 && moves < previous.bestMoves);
    const bestMoves = previous.bestMoves ? Math.min(previous.bestMoves, moves || previous.bestMoves) : moves;
    const bestTimeMs = previous.bestTimeMs ? Math.min(previous.bestTimeMs, elapsedMs || previous.bestTimeMs) : elapsedMs;
    const bestStars = Math.max(previous.stars || 0, stars);

    this.cache.levels[levelKey] = {
      levelId,
      bestMoves,
      bestTimeMs,
      stars: bestStars,
      updatedAt: Date.now()
    };
    this.cache.totalStars = this.computeTotalStars();
    this.cache.updatedAt = Date.now();
    this.saveLocal();

    const kvDataList = this.buildCloudKv(levelId, this.cache.levels[levelKey]);
    const cloudSynced = await this.setUserCloudStorage(kvDataList).then(() => true).catch(() => false);
    const provinceSynced = await this.submitProvinceScore(levelId, this.cache.levels[levelKey]).then(() => true).catch(() => false);
    return {
      success: true,
      record: this.cache.levels[levelKey],
      previousRecord,
      isPersonalBest,
      friendBenchmark,
      beatFriendRecord: Boolean(friendBenchmark && friendBenchmark.bestMoves > 0 && moves > 0 && moves < friendBenchmark.bestMoves),
      cloudSynced,
      provinceSynced,
      kvDataList
    };
  }

  buildCloudKv(levelId, record) {
    return [
      { key: `level_${levelId}_best_moves`, value: String(record.bestMoves || 0) },
      { key: `level_${levelId}_stars`, value: String(record.stars || 0) },
      { key: `level_${levelId}_best_time_ms`, value: String(record.bestTimeMs || 0) },
      { key: 'total_stars', value: String(this.cache.totalStars || 0) }
    ];
  }

  async getFriendLeaderboard(levelId = 1) {
    const keyList = [`level_${levelId}_best_moves`, `level_${levelId}_stars`, 'total_stars'];
    if (this.wx && typeof this.wx.getFriendCloudStorage === 'function') {
      const response = await callWx(this.wx.getFriendCloudStorage, this.wx, { keyList });
      return this.normalizeFriendRows(levelId, response.data || []);
    }
    return this.getLocalRows(levelId);
  }

  async getFriendBenchmark(levelId = 1) {
    const rows = await this.getFriendLeaderboard(levelId);
    const friendRows = rows.filter((row) => !this.isSelfRow(row));
    if (!friendRows.length) return null;
    return friendRows.reduce((best, row) => {
      if (!best || row.bestMoves < best.bestMoves || (row.bestMoves === best.bestMoves && row.stars > best.stars)) {
        return row;
      }
      return best;
    }, null);
  }

  isSelfRow(row = {}) {
    if (row.isSelf) return true;
    if (row.nickname && this.playerName && row.nickname === this.playerName) return true;
    if (row.avatarUrl && this.avatarUrl && row.avatarUrl === this.avatarUrl) return true;
    return false;
  }

  async showFriendLeaderboard(levelId = 1, options = {}) {
    const context = this.wx && typeof this.wx.getOpenDataContext === 'function'
      ? this.wx.getOpenDataContext()
      : null;
    const message = {
      type: 'renderLeaderboard',
      levelId,
      keyList: [`level_${levelId}_best_moves`, `level_${levelId}_stars`, 'total_stars'],
      title: options.title || `Level ${levelId} Friends`,
      width: options.width || 375,
      height: options.height || 420
    };
    this.lastOpenDataMessage = message;
    if (context && typeof context.postMessage === 'function') {
      context.postMessage(message);
    }
    const rows = context ? [] : await this.getFriendLeaderboard(levelId).catch(() => this.getLocalRows(levelId));
    return { success: true, message, rows, usesOpenDataContext: Boolean(context) };
  }

  async getProvinceLeaderboard(levelId = 1, province = this.province) {
    if (this.wx && this.wx.cloud && typeof this.wx.cloud.callFunction === 'function') {
      const response = await callWx(this.wx.cloud.callFunction, this.wx.cloud, {
        name: 'leaderboard',
        data: {
          action: 'getProvinceLeaderboard',
          levelId,
          province
        }
      });
      return response.result && Array.isArray(response.result.rows) ? response.result.rows : [];
    }
    return this.getLocalRows(levelId);
  }

  getRankingPercent(levelId, moves) {
    const rows = this.getLocalRows(levelId);
    if (!rows.length || !moves) return null;
    const betterOrEqual = rows.filter((row) => row.bestMoves >= moves).length;
    return Math.max(1, Math.min(99, Math.round((betterOrEqual / rows.length) * 100)));
  }

  drawOpenDataContext(ctx, x, y, width, height) {
    const context = this.wx && typeof this.wx.getOpenDataContext === 'function'
      ? this.wx.getOpenDataContext()
      : null;
    const sharedCanvas = context && context.canvas;
    if (!ctx || !sharedCanvas || typeof ctx.drawImage !== 'function') return false;
    ctx.drawImage(sharedCanvas, x, y, width, height);
    return true;
  }

  normalizeFriendRows(levelId, data) {
    const moveKey = `level_${levelId}_best_moves`;
    const starKey = `level_${levelId}_stars`;
    return (data || []).map((entry, index) => {
      const kv = {};
      (entry.KVDataList || []).forEach((item) => { kv[item.key] = item.value; });
      return {
        rank: index + 1,
        nickname: entry.nickname || `Friend ${index + 1}`,
        avatarUrl: entry.avatarUrl || '',
        bestMoves: Number(kv[moveKey] || 0),
        stars: Number(kv[starKey] || 0),
        totalStars: Number(kv.total_stars || 0)
      };
    }).filter((row) => row.bestMoves > 0).sort((a, b) => a.bestMoves - b.bestMoves || b.stars - a.stars)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  getLocalRows(levelId) {
    const record = this.cache.levels[String(levelId)];
    if (!record) return [];
    return [{
      rank: 1,
      nickname: this.playerName,
      avatarUrl: this.avatarUrl,
      bestMoves: record.bestMoves,
      stars: record.stars,
      totalStars: this.cache.totalStars || 0
    }];
  }

  loadLocal() {
    const storage = getStorage(this.wx);
    return storage.get(this.storageKey) || { levels: {}, totalStars: 0, updatedAt: 0 };
  }

  saveLocal() {
    getStorage(this.wx).set(this.storageKey, this.cache);
  }

  computeTotalStars() {
    return Object.keys(this.cache.levels).reduce((sum, key) => sum + (this.cache.levels[key].stars || 0), 0);
  }

  submitProvinceScore(levelId, record) {
    if (!this.wx || !this.wx.cloud || typeof this.wx.cloud.callFunction !== 'function') {
      return Promise.resolve({ mock: true });
    }
    return callWx(this.wx.cloud.callFunction, this.wx.cloud, {
      name: 'leaderboard',
      data: {
        action: 'submitProvinceScore',
        levelId,
        province: this.province,
        record
      }
    });
  }

  setUserCloudStorage(KVDataList) {
    if (!this.wx || typeof this.wx.setUserCloudStorage !== 'function') {
      return Promise.resolve({ mock: true });
    }
    return callWx(this.wx.setUserCloudStorage, this.wx, { KVDataList });
  }
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

function callWx(fn, context, payload) {
  return new Promise((resolve, reject) => {
    fn.call(context, {
      ...payload,
      success: resolve,
      fail: reject
    });
  });
}

module.exports = LeaderboardManager;
