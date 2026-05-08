const PRESETS = [
  null,
  { level: 1, fillRate: 0.5, directRatio: 0.8, chainLength: [1, 2], rewindCoverage: 0.1, rewindDepth: 1 },
  { level: 2, fillRate: 0.5, directRatio: 0.8, chainLength: [1, 2], rewindCoverage: 0.12, rewindDepth: 1 },
  { level: 3, fillRate: 0.5, directRatio: 0.8, chainLength: [2, 3], rewindCoverage: 0.15, rewindDepth: 1 },
  { level: 4, fillRate: 0.75, directRatio: 0.5, chainLength: [3, 4], rewindCoverage: 0.3, rewindDepth: 1 },
  { level: 5, fillRate: 0.75, directRatio: 0.5, chainLength: [3, 5], rewindCoverage: 0.34, rewindDepth: 1 },
  { level: 6, fillRate: 0.75, directRatio: 0.5, chainLength: [4, 5], rewindCoverage: 0.38, rewindDepth: 2 },
  { level: 7, fillRate: 0.875, directRatio: 0.3, chainLength: [5, 6], rewindCoverage: 0.55, rewindDepth: 2 },
  { level: 8, fillRate: 0.875, directRatio: 0.3, chainLength: [5, 8], rewindCoverage: 0.6, rewindDepth: 2 },
  { level: 9, fillRate: 0.875, directRatio: 0.3, chainLength: [6, 8], rewindCoverage: 0.65, rewindDepth: 2 },
  { level: 10, fillRate: 1, directRatio: 0.15, chainLength: [8, 12], rewindCoverage: 0.75, rewindDepth: 3 }
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
    return Object.assign({}, base, difficulty);
  }

  static getConfig(level = 1) {
    const clamped = Math.min(10, Math.max(1, Math.round(Number(level) || 1)));
    return Object.assign({}, PRESETS[clamped]);
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
}

module.exports = Difficulty;
