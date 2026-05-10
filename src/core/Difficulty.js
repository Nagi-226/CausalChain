const PRESETS = [
  null,
  { level: 1, fillRate: 0.5, directRatio: 0.8, chainLength: [1, 2], rewindCoverage: 0.1, rewindDepth: 1, paradoxRatio: 0, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 2, fillRate: 0.5, directRatio: 0.8, chainLength: [1, 2], rewindCoverage: 0.12, rewindDepth: 1, paradoxRatio: 0, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 3, fillRate: 0.5, directRatio: 0.8, chainLength: [2, 3], rewindCoverage: 0.15, rewindDepth: 1, paradoxRatio: 0, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 4, fillRate: 0.75, directRatio: 0.5, chainLength: [3, 4], rewindCoverage: 0.3, rewindDepth: 1, paradoxRatio: 0, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 5, fillRate: 0.75, directRatio: 0.5, chainLength: [3, 5], rewindCoverage: 0.34, rewindDepth: 1, paradoxRatio: 0.05, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 6, fillRate: 0.75, directRatio: 0.5, chainLength: [4, 5], rewindCoverage: 0.38, rewindDepth: 2, paradoxRatio: 0.05, crossLayerRatio: 0, crossLayerDepth: 0 },
  { level: 7, fillRate: 0.875, directRatio: 0.3, chainLength: [5, 6], rewindCoverage: 0.55, rewindDepth: 2, paradoxRatio: 0.10, crossLayerRatio: 0.05, crossLayerDepth: 2 },
  { level: 8, fillRate: 0.875, directRatio: 0.3, chainLength: [5, 8], rewindCoverage: 0.6, rewindDepth: 2, paradoxRatio: 0.12, crossLayerRatio: 0.10, crossLayerDepth: 2 },
  { level: 9, fillRate: 0.875, directRatio: 0.3, chainLength: [6, 8], rewindCoverage: 0.65, rewindDepth: 2, paradoxRatio: 0.15, crossLayerRatio: 0.10, crossLayerDepth: 2 },
  { level: 10, fillRate: 1, directRatio: 0.15, chainLength: [8, 12], rewindCoverage: 0.75, rewindDepth: 3, paradoxRatio: 0.25, crossLayerRatio: 0.25, crossLayerDepth: 2 },
  { level: 11, fillRate: 0.88, directRatio: 0.4, chainLength: [4, 6], rewindCoverage: 0.42, rewindDepth: 2, paradoxRatio: 0.10, crossLayerRatio: 0.08, crossLayerDepth: 2 },
  { level: 12, fillRate: 0.88, directRatio: 0.35, chainLength: [4, 7], rewindCoverage: 0.48, rewindDepth: 2, paradoxRatio: 0.12, crossLayerRatio: 0.10, crossLayerDepth: 2 },
  { level: 13, fillRate: 0.92, directRatio: 0.3, chainLength: [5, 7], rewindCoverage: 0.52, rewindDepth: 2, paradoxRatio: 0.14, crossLayerRatio: 0.12, crossLayerDepth: 2 },
  { level: 14, fillRate: 0.92, directRatio: 0.3, chainLength: [5, 8], rewindCoverage: 0.56, rewindDepth: 3, paradoxRatio: 0.16, crossLayerRatio: 0.14, crossLayerDepth: 2 },
  { level: 15, fillRate: 0.95, directRatio: 0.25, chainLength: [5, 9], rewindCoverage: 0.6, rewindDepth: 3, paradoxRatio: 0.18, crossLayerRatio: 0.16, crossLayerDepth: 2 },
  { level: 16, fillRate: 0.95, directRatio: 0.25, chainLength: [6, 9], rewindCoverage: 0.64, rewindDepth: 3, paradoxRatio: 0.20, crossLayerRatio: 0.18, crossLayerDepth: 2 },
  { level: 17, fillRate: 0.97, directRatio: 0.2, chainLength: [6, 10], rewindCoverage: 0.68, rewindDepth: 3, paradoxRatio: 0.22, crossLayerRatio: 0.20, crossLayerDepth: 3 },
  { level: 18, fillRate: 0.97, directRatio: 0.2, chainLength: [7, 10], rewindCoverage: 0.72, rewindDepth: 4, paradoxRatio: 0.24, crossLayerRatio: 0.22, crossLayerDepth: 3 },
  { level: 19, fillRate: 1, directRatio: 0.15, chainLength: [7, 11], rewindCoverage: 0.78, rewindDepth: 4, paradoxRatio: 0.25, crossLayerRatio: 0.25, crossLayerDepth: 3 },
  { level: 20, fillRate: 1, directRatio: 0.15, chainLength: [8, 12], rewindCoverage: 0.85, rewindDepth: 4, paradoxRatio: 0.30, crossLayerRatio: 0.30, crossLayerDepth: 3 }
];

class Difficulty {
  static normalize(difficulty = 1) {
    if (typeof difficulty === 'number') {
      return Difficulty.getConfig(difficulty);
    }
    if (!difficulty || typeof difficulty !== 'object') {
      return Difficulty.getConfig(1);
    }
    const base = Difficulty.getConfig(difficulty.level || 1);
    return Difficulty._cloneConfig(Object.assign({}, base, difficulty));
  }

  static getConfig(level = 1) {
    const clamped = Math.min(20, Math.max(1, Math.round(Number(level) || 1)));
    return Difficulty._cloneConfig(PRESETS[clamped] || PRESETS[10]);
  }

  static getTileCount(difficulty = 1, rows = 6, cols = 8) {
    const config = Difficulty.normalize(difficulty);
    const capacity = rows * cols;
    let count = Math.round(capacity * config.fillRate);
    if (count % 2 !== 0) count -= 1;
    return Math.min(capacity, Math.max(2, count));
  }

  static getPairCount(difficulty = 1, rows = 6, cols = 8) {
    return Difficulty.getTileCount(difficulty, rows, cols) / 2;
  }

  static _cloneConfig(config) {
    const clone = Object.assign({}, config);
    clone.chainLength = Array.isArray(config.chainLength) ? config.chainLength.slice() : [1, 1];
    if (clone.crossLayerDepth === undefined) clone.crossLayerDepth = clone.crossLayerRatio > 0 ? 2 : 0;
    return clone;
  }
}

module.exports = Difficulty;
