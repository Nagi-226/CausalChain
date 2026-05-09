const CausalEngine = require('./CausalEngine.js');
const Solver = require('./Solver.js');

class BoardValidator {
  constructor(options = {}) {
    this.rows = options.rows || 6;
    this.cols = options.cols || 8;
    this.solver = options.solver || new Solver(options);
  }

  validate(board) {
    const errors = [];
    if (!Array.isArray(board) || board.length !== this.rows) {
      errors.push(`board_rows_expected_${this.rows}`);
    }

    const ids = new Set();
    const counts = {};
    for (let row = 0; row < (board || []).length; row += 1) {
      if (!Array.isArray(board[row]) || board[row].length !== this.cols) {
        errors.push(`board_cols_expected_${this.cols}_at_row_${row}`);
        continue;
      }
      for (let col = 0; col < board[row].length; col += 1) {
        const tile = board[row][col];
        if (!tile) continue;
        if (!tile.id) errors.push(`tile_missing_id_${row}_${col}`);
        if (tile.id && ids.has(tile.id)) errors.push(`tile_duplicate_id_${tile.id}`);
        if (tile.id) ids.add(tile.id);
        if (!tile.color || !tile.icon) errors.push(`tile_missing_pair_${row}_${col}`);
        if (![CausalEngine.TILE_TYPES.CAUSE, CausalEngine.TILE_TYPES.EFFECT, CausalEngine.TILE_TYPES.PARADOX].includes(tile.type)) {
          errors.push(`tile_bad_type_${row}_${col}`);
        }
        const key = CausalEngine.getPairKey(tile);
        if (!counts[key]) counts[key] = { cause: 0, effect: 0, paradox: 0 };
        if (tile.type === CausalEngine.TILE_TYPES.CAUSE) counts[key].cause += 1;
        if (tile.type === CausalEngine.TILE_TYPES.EFFECT) counts[key].effect += 1;
        if (tile.type === CausalEngine.TILE_TYPES.PARADOX) counts[key].paradox += 1;
      }
    }

    for (const key of Object.keys(counts)) {
      const c = counts[key];
      if (c.cause + c.paradox !== c.effect + c.paradox) {
        errors.push(`unbalanced_pair_${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      stats: this.getStats(board)
    };
  }

  hasLegalMove(board) {
    return CausalEngine.findLegalMoves(board).length > 0;
  }

  isSolvable(board, options = {}) {
    const validation = this.validate(board);
    if (!validation.valid) return false;
    return this.solver.isSolvable(board, options);
  }

  solve(board, options = {}) {
    const validation = this.validate(board);
    if (!validation.valid) {
      return { solved: false, path: [], minSteps: Infinity, reason: 'invalid_board', errors: validation.errors };
    }
    return this.solver.solve(board, options);
  }

  getStats(board) {
    let tileCount = 0;
    const pairCounts = {};
    for (const row of board || []) {
      for (const tile of row || []) {
        if (!tile) continue;
        tileCount += 1;
        const key = CausalEngine.getPairKey(tile);
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
    return {
      rows: Array.isArray(board) ? board.length : 0,
      cols: Array.isArray(board) && board[0] ? board[0].length : 0,
      tileCount,
      pairCounts,
      legalMoves: Array.isArray(board) ? CausalEngine.findLegalMoves(board).length : 0
    };
  }

  static validate(board, options = {}) {
    return new BoardValidator(options).validate(board);
  }

  static isSolvable(board, options = {}) {
    return new BoardValidator(options).isSolvable(board, options);
  }
}

module.exports = BoardValidator;
