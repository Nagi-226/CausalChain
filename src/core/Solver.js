const CausalEngine = require('./CausalEngine.js');

class Solver {
  constructor(options = {}) {
    this.bfsLimit = options.bfsLimit || 14;
  }

  solve(board, options = {}) {
    const activeCount = Solver.countTiles(board);
    if (activeCount === 0) {
      return { solved: true, path: [], minSteps: 0, method: 'empty' };
    }
    if (activeCount % 2 !== 0) {
      return { solved: false, path: [], minSteps: Infinity, method: 'parity', reason: 'odd_tile_count' };
    }

    const bfsLimit = options.bfsLimit || this.bfsLimit;
    if (activeCount <= bfsLimit) {
      return this._solveBFS(board, options);
    }
    return this._solveByMatching(board);
  }

  isSolvable(board, options = {}) {
    return this.solve(board, options).solved;
  }

  getMinimumSteps(board, options = {}) {
    const result = this.solve(board, options);
    return result.solved ? result.minSteps : Infinity;
  }

  findReferencePath(board, options = {}) {
    return this.solve(board, options).path;
  }

  _solveBFS(board, options = {}) {
    const start = CausalEngine.cloneBoard(board);
    const startKey = Solver.keyOf(start);
    const queue = [{ board: start, path: [] }];
    const seen = new Set([startKey]);
    const maxStates = options.maxStates || 50000;
    let cursor = 0;

    while (cursor < queue.length && seen.size <= maxStates) {
      const state = queue[cursor];
      cursor += 1;
      const moves = CausalEngine.findLegalMoves(state.board);

      for (const move of moves) {
        const nextBoard = Solver.applyMove(state.board, move);
        const nextPath = state.path.concat(Solver.normalizeMove(move, state.board));
        if (Solver.countTiles(nextBoard) === 0) {
          return { solved: true, path: nextPath, minSteps: nextPath.length, method: 'bfs' };
        }

        const key = Solver.keyOf(nextBoard);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ board: nextBoard, path: nextPath });
        }
      }
    }

    const matching = this._solveByMatching(board);
    if (matching.solved) return matching;
    return {
      solved: false,
      path: [],
      minSteps: Infinity,
      method: 'bfs',
      reason: seen.size > maxStates ? 'state_limit' : 'no_solution'
    };
  }

  _solveByMatching(board) {
    const groups = this._groupTiles(board);
    const path = [];

    for (const pairKey of Object.keys(groups)) {
      const group = groups[pairKey];
      if (group.causes.length !== group.effects.length) {
        return {
          solved: false,
          path: [],
          minSteps: Infinity,
          method: 'matching',
          reason: 'unbalanced_pair',
          pairKey
        };
      }

      const matchedEffects = new Map();
      for (const cause of group.causes) {
        const seen = new Set();
        if (!this._augment(cause, group.effects, matchedEffects, seen)) {
          return {
            solved: false,
            path: [],
            minSteps: Infinity,
            method: 'matching',
            reason: 'unmatched_cause',
            pairKey
          };
        }
      }

      for (const [effectId, cause] of matchedEffects.entries()) {
        const effect = group.effects.find((item) => item.tile.id === effectId);
        path.push({
          from: { row: cause.row, col: cause.col },
          to: { row: effect.row, col: effect.col },
          pairKey,
          sourceId: cause.tile.id,
          targetId: effect.tile.id
        });
      }
    }

    return { solved: true, path, minSteps: path.length, method: 'matching' };
  }

  _groupTiles(board) {
    const groups = {};
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const tile = board[row][col];
        if (!tile) continue;
        const key = CausalEngine.getPairKey(tile);
        if (!groups[key]) groups[key] = { causes: [], effects: [] };
        const entry = { row, col, tile };
        if (tile.type === CausalEngine.TILE_TYPES.CAUSE || tile.type === CausalEngine.TILE_TYPES.PARADOX) {
          groups[key].causes.push(entry);
        }
        if (tile.type === CausalEngine.TILE_TYPES.EFFECT || tile.type === CausalEngine.TILE_TYPES.PARADOX) {
          groups[key].effects.push(entry);
        }
      }
    }
    return groups;
  }

  _augment(cause, effects, matchedEffects, seen) {
    for (const effect of effects) {
      if (!CausalEngine.isAdjacent(cause, effect)) continue;
      const effectId = effect.tile.id;
      if (seen.has(effectId)) continue;
      seen.add(effectId);

      const currentCause = matchedEffects.get(effectId);
      if (!currentCause || this._augment(currentCause, effects, matchedEffects, seen)) {
        matchedEffects.set(effectId, cause);
        return true;
      }
    }
    return false;
  }

  static normalizeMove(move, board) {
    const source = board[move.from.row][move.from.col];
    const target = board[move.to.row][move.to.col];
    return {
      from: Object.assign({}, move.from),
      to: Object.assign({}, move.to),
      pairKey: move.pairKey,
      sourceId: source && source.id,
      targetId: target && target.id
    };
  }

  static applyMove(board, move) {
    const next = CausalEngine.cloneBoard(board);
    next[move.from.row][move.from.col] = null;
    next[move.to.row][move.to.col] = null;
    return next;
  }

  static countTiles(board) {
    let count = 0;
    for (const row of board) {
      for (const tile of row) {
        if (tile) count += 1;
      }
    }
    return count;
  }

  static keyOf(board) {
    const parts = [];
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const tile = board[row][col];
        parts.push(tile ? `${tile.id}@${row},${col}` : '.');
      }
    }
    return parts.join('|');
  }
}

module.exports = Solver;
