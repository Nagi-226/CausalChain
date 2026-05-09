const EventBus = require('../utils/EventBus.js');
const Difficulty = require('./Difficulty.js');

const TILE_TYPES = Object.freeze({
  CAUSE: 'cause',
  EFFECT: 'effect',
  PARADOX: 'paradox'
});

const COLORS = Object.freeze(['crimson', 'azure', 'gold']);
const ICONS = Object.freeze(['spark', 'leaf', 'moon']);
const PAIR_TYPES = Object.freeze(
  COLORS.flatMap((color) => ICONS.map((icon) => Object.freeze({ color, icon, key: `${color}:${icon}` })))
);

class PRNG {
  constructor(seed = Date.now()) {
    this.state = PRNG.hash(seed);
  }

  static hash(seed) {
    const text = String(seed);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }

  next() {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(max) {
    return Math.floor(this.next() * max);
  }

  shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.int(i + 1);
      const value = items[i];
      items[i] = items[j];
      items[j] = value;
    }
    return items;
  }
}

class CausalEngine {
  constructor(options = {}) {
    this.rows = options.rows || 6;
    this.cols = options.cols || 8;
    this.difficulty = Difficulty.normalize(options.difficulty || 1);
    this.eventBus = options.eventBus || new EventBus();
    this.rng = new PRNG(options.seed || Date.now());
    this.board = CausalEngine.cloneBoard(options.board || this._generateInitialBoard(options));
    this.goals = Object.assign({ clearAll: true, moveBudget: 0 }, options.goals || {});
    this.moveBudget = Math.max(0, Number(options.moveBudget || this.goals.moveBudget || 0));
    this.steps = 0;
    this.score = 0;
    this.rewindCount = 0;
    this.reshuffleCount = 0;
    this.freezeNext = false;
    this.history = [];
  }

  _generateInitialBoard(options) {
    const BoardGenerator = require('./BoardGenerator.js');
    return new BoardGenerator({
      rows: this.rows,
      cols: this.cols,
      difficulty: this.difficulty,
      seed: options.seed
    }).generate().board;
  }

  setBoard(board, options = {}) {
    this.board = CausalEngine.cloneBoard(board);
    if (options.clearHistory !== false) this.history = [];
    this.eventBus.emit('board:changed', this.getStateSnapshot());
    return this;
  }

  getTile(position) {
    const pos = CausalEngine.normalizePosition(position);
    if (!this.isInside(pos)) return null;
    return this.board[pos.row][pos.col];
  }

  isInside(position) {
    return (
      position &&
      position.row >= 0 &&
      position.row < this.rows &&
      position.col >= 0 &&
      position.col < this.cols
    );
  }

  isAdjacent(a, b) {
    return CausalEngine.isAdjacent(a, b);
  }

  canMatch(from, to) {
    const sourcePos = CausalEngine.normalizePosition(from);
    const targetPos = CausalEngine.normalizePosition(to);
    const source = this.getTile(sourcePos);
    const target = this.getTile(targetPos);

    if (!source || !target) return { valid: false, reason: 'empty_tile', source, target };
    if (!this.isAdjacent(sourcePos, targetPos)) {
      return { valid: false, reason: 'not_adjacent', source, target };
    }

    const isParadox = (tile) => tile.type === TILE_TYPES.PARADOX;
    const sourceParadox = isParadox(source);
    const targetParadox = isParadox(target);

    if (source.type === TILE_TYPES.CAUSE && target.type === TILE_TYPES.EFFECT) {
      // standard cause→effect
    } else if (sourceParadox && target.type === TILE_TYPES.EFFECT) {
      // paradox acts as cause
    } else if (source.type === TILE_TYPES.CAUSE && targetParadox) {
      // paradox acts as effect
    } else if (sourceParadox && targetParadox) {
      // dual paradox — both can play either role
    } else {
      return { valid: false, reason: sourceParadox ? 'target_not_compatible' : 'source_not_cause', source, target };
    }

    if (source.color !== target.color || source.icon !== target.icon) {
      return { valid: false, reason: 'pair_mismatch', source, target };
    }

    return { valid: true, reason: sourceParadox || targetParadox ? 'paradox_match' : 'ok', source, target };
  }

  processMove(from, to, options = {}) {
    const statusBefore = this.getStatus();
    if (statusBefore !== 'playing' && options.ignoreTerminal !== true) {
      const failure = { success: false, reason: 'game_over', status: statusBefore };
      this.eventBus.emit('match:failed', failure);
      return failure;
    }

    const sourcePos = CausalEngine.normalizePosition(from);
    const targetPos = CausalEngine.normalizePosition(to);
    const match = this.canMatch(sourcePos, targetPos);

    if (!match.valid) {
      const failure = { success: false, reason: match.reason, from: sourcePos, to: targetPos };
      this.eventBus.emit('match:failed', failure);
      return failure;
    }

    const before = this.getStateSnapshot({ includeHistory: false });
    const frozen = Boolean(this.freezeNext || options.freezeRewind);
    const removed = [
      { row: sourcePos.row, col: sourcePos.col, tile: CausalEngine.cloneTile(match.source) },
      { row: targetPos.row, col: targetPos.col, tile: CausalEngine.cloneTile(match.target) }
    ];

    this.board[sourcePos.row][sourcePos.col] = null;
    this.board[targetPos.row][targetPos.col] = null;

    const rewindLayers = frozen ? [] : this._computeRewindLayers([sourcePos, targetPos], removed);
    if (this.freezeNext) this.freezeNext = false;

    this.steps += 1;
    this.score += 1;
    if (rewindLayers.length > 0) this.rewindCount += 1;

    const move = {
      from: sourcePos,
      to: targetPos,
      sourceId: match.source.id,
      targetId: match.target.id,
      pairId: match.source.pairId || match.target.pairId || null,
      pairKey: CausalEngine.getPairKey(match.source),
      removed,
      rewindLayers,
      rewindFrozen: frozen
    };
    this.history.push({ before, move });

    const status = this.getStatus();
    const result = {
      success: true,
      move,
      status,
      reason: status === 'lost' ? this.getFailReason() : undefined,
      snapshot: this.getStateSnapshot({ includeHistory: false })
    };
    this.eventBus.emit('match:success', result);
    this.eventBus.emit('board:changed', result.snapshot);
    return result;
  }

  eliminate(from, to, options = {}) {
    return this.processMove(from, to, options);
  }

  freezeNextRewind() {
    this.freezeNext = true;
    this.eventBus.emit('item:freeze', { freezeNext: true });
    return true;
  }

  undo() {
    const entry = this.history.pop();
    if (!entry) return { success: false, reason: 'empty_history' };
    this.restoreStateSnapshot(entry.before, { restoreHistory: false });
    const result = { success: true, undone: entry.move, status: this.getStatus() };
    this.eventBus.emit('move:undo', result);
    this.eventBus.emit('board:changed', this.getStateSnapshot({ includeHistory: false }));
    return result;
  }

  reshuffle(seed = null) {
    const rng = new PRNG(seed || this.rng.state);
    const positions = [];
    const tiles = [];

    this.forEachTile((tile, row, col) => {
      positions.push({ row, col });
      tiles.push(CausalEngine.cloneTile(tile));
    });

    if (tiles.length < 2) return { success: false, reason: 'not_enough_tiles' };

    const before = CausalEngine.cloneBoard(this.board);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const shuffled = rng.shuffle(tiles.map(CausalEngine.cloneTile));
      for (let i = 0; i < positions.length; i += 1) {
        const pos = positions[i];
        this.board[pos.row][pos.col] = Object.assign(shuffled[i], pos);
      }
      if (this.findLegalMoves().length > 0 || this.isWin()) {
        this.reshuffleCount += 1;
        const result = { success: true, attempts: attempt + 1, status: this.getStatus() };
        this.eventBus.emit('board:reshuffle', result);
        this.eventBus.emit('board:changed', this.getStateSnapshot({ includeHistory: false }));
        return result;
      }
    }

    this.board = before;
    return { success: false, reason: 'no_legal_shuffle' };
  }

  findLegalMoves() {
    return CausalEngine.findLegalMoves(this.board);
  }

  hasLegalMove() {
    return this.findLegalMoves().length > 0;
  }

  isWin() {
    return this.countTiles() === 0;
  }

  isDead() {
    return !this.isWin() && !this.hasLegalMove();
  }

  isMoveBudgetSpent() {
    return Boolean(this.moveBudget > 0 && this.steps >= this.moveBudget && !this.isWin());
  }

  getFailReason() {
    if (this.isMoveBudgetSpent()) return 'moveBudget';
    if (this.isDead()) return 'noMoves';
    return 'unknown';
  }

  getStatus() {
    if (this.isWin()) return 'won';
    if (this.isMoveBudgetSpent()) return 'lost';
    if (this.isDead()) return 'lost';
    return 'playing';
  }

  countTiles() {
    let count = 0;
    this.forEachTile(() => {
      count += 1;
    });
    return count;
  }

  forEachTile(callback) {
    for (let row = 0; row < this.board.length; row += 1) {
      for (let col = 0; col < this.board[row].length; col += 1) {
        const tile = this.board[row][col];
        if (tile) callback(tile, row, col);
      }
    }
  }

  getStateSnapshot(options = {}) {
    const snapshot = {
      rows: this.rows,
      cols: this.cols,
      board: CausalEngine.cloneBoard(this.board),
      steps: this.steps,
      score: this.score,
      goals: Object.assign({}, this.goals),
      moveBudget: this.moveBudget,
      remainingMoves: this.moveBudget > 0 ? Math.max(0, this.moveBudget - this.steps) : null,
      rewindCount: this.rewindCount,
      reshuffleCount: this.reshuffleCount,
      freezeNext: this.freezeNext,
      status: this.getStatus()
    };
    if (options.includeHistory) {
      snapshot.history = this.history.map((entry) => ({
        before: CausalEngine.cloneSnapshot(entry.before),
        move: CausalEngine.cloneMove(entry.move)
      }));
    }
    return snapshot;
  }

  restoreStateSnapshot(snapshot, options = {}) {
    this.rows = snapshot.rows;
    this.cols = snapshot.cols;
    this.board = CausalEngine.cloneBoard(snapshot.board);
    this.steps = snapshot.steps || 0;
    this.score = snapshot.score || 0;
    this.goals = Object.assign({ clearAll: true, moveBudget: 0 }, snapshot.goals || this.goals || {});
    this.moveBudget = Math.max(0, Number(snapshot.moveBudget || this.goals.moveBudget || 0));
    this.rewindCount = snapshot.rewindCount || 0;
    this.reshuffleCount = snapshot.reshuffleCount || 0;
    this.freezeNext = Boolean(snapshot.freezeNext);
    if (options.restoreHistory !== false) {
      this.history = (snapshot.history || []).map((entry) => ({
        before: CausalEngine.cloneSnapshot(entry.before),
        move: CausalEngine.cloneMove(entry.move)
      }));
    }
    return this;
  }

  getCausalInsight() {
    const Solver = require('./Solver.js');
    const solution = new Solver().solve(this.board);
    const move = solution.solved && solution.path.length > 0 ? solution.path[0] : this.findLegalMoves()[0];
    return move ? this.traceCausalPath(move) : [];
  }

  traceCausalPath(move, maxDepth = 6) {
    const source = this.getTile(move.from);
    const target = this.getTile(move.to);
    const path = [source, target].filter(Boolean).map(CausalEngine.cloneTile);
    const seenPairs = new Set(path.map((tile) => tile.pairId).filter(Boolean));
    let frontier = path;

    for (let depth = 0; depth < maxDepth; depth += 1) {
      const next = [];
      for (const tile of frontier) {
        const linked = this._getLinkedTiles(tile);
        for (const linkedTile of linked) {
          if (linkedTile.pairId && seenPairs.has(linkedTile.pairId)) continue;
          if (linkedTile.pairId) seenPairs.add(linkedTile.pairId);
          next.push(linkedTile);
          path.push(CausalEngine.cloneTile(linkedTile));
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    return path;
  }

  _computeRewindLayers(startPositions, removed) {
    const removedKeys = new Set(removed.map((item) => `${item.row},${item.col}`));
    const visited = new Set(startPositions.map((pos) => `${pos.row},${pos.col}`));
    const removedByPosition = new Map(removed.map((item) => [`${item.row},${item.col}`, item.tile]));
    let frontier = startPositions.slice();
    const layers = [];
    const depth = Math.max(1, this.difficulty.rewindDepth || 1);
    const crossLayer = Math.max(0, this.difficulty.crossLayerDepth || 0);
    const paradoxProb = this.difficulty.paradoxRatio || 0;
    const hasParadoxTrigger = removed.some((item) => item.tile && item.tile.type === TILE_TYPES.PARADOX);

    for (let step = 1; step <= depth; step += 1) {
      const next = [];
      const layer = [];
      for (const pos of frontier) {
        const sourceTile = removedByPosition.get(`${pos.row},${pos.col}`) || this.getTile(pos);
        const candidates = CausalEngine.getNeighbors(pos, this.rows, this.cols).map((neighbor) => ({
          row: neighbor.row,
          col: neighbor.col,
          relation: 'adjacent'
        }));
        for (const linked of this._getLinkedTiles(sourceTile, 1)) {
          candidates.push({ row: linked.row, col: linked.col, relation: 'chain', tileId: linked.id });
        }

        // cross-layer traversal: follow causalLinks 2-3 hops deep
        if (crossLayer > 1 && sourceTile) {
          const crossLinked = this._getLinkedTilesRecursive(sourceTile, crossLayer, new Set());
          for (const crossTile of crossLinked) {
            candidates.push({ row: crossTile.row, col: crossTile.col, relation: 'cross-chain', tileId: crossTile.id });
          }
        }

        for (const neighbor of candidates) {
          const key = `${neighbor.row},${neighbor.col}`;
          if (visited.has(key)) continue;
          visited.add(key);
          next.push(neighbor);
          if (removedKeys.has(key)) continue;
          const tile = this.getTile(neighbor);
          if (tile) {
            // paradox trigger: chance of extra rewind expansion
            const relation = hasParadoxTrigger && this.rng.next() < paradoxProb ? 'paradox_expand' : (neighbor.relation || 'adjacent');
            layer.push({
              row: neighbor.row,
              col: neighbor.col,
              tileId: tile.id,
              depth: step,
              relation,
              pairId: tile.pairId || null
            });
          }
        }
      }
      if (layer.length > 0) layers.push(layer);
      frontier = next;
    }
    return layers;
  }

  _getLinkedTiles(sourceTile, maxHop = 1) {
    if (!sourceTile) return [];
    const links = Array.isArray(sourceTile.causalLinks) ? sourceTile.causalLinks : [];
    const linked = [];
    const seen = new Set();

    const addTile = (tile) => {
      if (!tile || seen.has(tile.id)) return;
      seen.add(tile.id);
      linked.push(tile);
    };

    for (const link of links) {
      if (maxHop < 1) continue;
      if (link.targetTileId) addTile(this._findTileById(link.targetTileId));
      if (link.targetPairId) {
        this.forEachTile((tile) => {
          if (tile.pairId === link.targetPairId) addTile(tile);
        });
      }
    }

    this.forEachTile((tile) => {
      const tileLinks = Array.isArray(tile.causalLinks) ? tile.causalLinks : [];
      for (const link of tileLinks) {
        if (link.sourceTileId === sourceTile.id || (sourceTile.pairId && link.sourcePairId === sourceTile.pairId)) {
          addTile(tile);
        }
      }
    });

    return linked;
  }

  _getLinkedTilesRecursive(sourceTile, maxDepth, visited) {
    if (!sourceTile || maxDepth <= 0) return [];
    const seen = visited || new Set();
    seen.add(sourceTile.id);
    const results = [];

    const directLinks = this._getLinkedTiles(sourceTile);
    for (const linked of directLinks) {
      if (seen.has(linked.id)) continue;
      seen.add(linked.id);
      results.push(linked);
      if (maxDepth > 1) {
        const subLinks = this._getLinkedTilesRecursive(linked, maxDepth - 1, seen);
        for (const sub of subLinks) {
          if (!seen.has(sub.id)) {
            seen.add(sub.id);
            results.push(sub);
          }
        }
      }
    }

    return results;
  }

  _findTileById(tileId) {
    let found = null;
    this.forEachTile((tile) => {
      if (!found && tile.id === tileId) found = tile;
    });
    return found;
  }

  static findLegalMoves(board) {
    const moves = [];
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = board[row][col];
        if (!tile) continue;
        if (tile.type !== TILE_TYPES.CAUSE && tile.type !== TILE_TYPES.PARADOX) continue;
        for (const neighbor of CausalEngine.getNeighbors({ row, col }, rows, cols)) {
          const target = board[neighbor.row][neighbor.col];
          if (!target) continue;
          if (target.type !== TILE_TYPES.EFFECT && target.type !== TILE_TYPES.PARADOX) continue;
          if (tile.color === target.color && tile.icon === target.icon) {
            moves.push({
              from: { row, col },
              to: { row: neighbor.row, col: neighbor.col },
              pairKey: CausalEngine.getPairKey(tile),
              sourceId: tile.id,
              targetId: target.id
            });
          }
        }
      }
    }
    return moves;
  }

  static createTile(type, color, icon, row, col, id = null) {
    return {
      id: id || `${type}-${color}-${icon}-${row}-${col}`,
      type,
      color,
      icon,
      row,
      col,
      pairKey: `${color}:${icon}`
    };
  }

  static getPairKey(tile) {
    return tile.pairKey || `${tile.color}:${tile.icon}`;
  }

  static normalizePosition(position) {
    if (Array.isArray(position)) return { row: position[0], col: position[1] };
    return { row: position.row, col: position.col };
  }

  static isAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  static getNeighbors(position, rows = 6, cols = 8) {
    const candidates = [
      { row: position.row - 1, col: position.col },
      { row: position.row + 1, col: position.col },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 }
    ];
    return candidates.filter((pos) => pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols);
  }

  static cloneTile(tile) {
    return tile ? Object.assign({}, tile) : null;
  }

  static cloneBoard(board) {
    return board.map((row) => row.map((tile) => CausalEngine.cloneTile(tile)));
  }

  static cloneMove(move) {
    if (!move) return null;
    return {
      from: Object.assign({}, move.from),
      to: Object.assign({}, move.to),
      pairKey: move.pairKey,
      sourceId: move.sourceId,
      targetId: move.targetId,
      pairId: move.pairId,
      removed: move.removed.map((item) => ({
        row: item.row,
        col: item.col,
        tile: CausalEngine.cloneTile(item.tile)
      })),
      rewindLayers: move.rewindLayers.map((layer) => layer.map((item) => Object.assign({}, item))),
      rewindFrozen: move.rewindFrozen
    };
  }

  static cloneSnapshot(snapshot) {
    const clone = Object.assign({}, snapshot, { board: CausalEngine.cloneBoard(snapshot.board) });
    if (snapshot.history) clone.history = snapshot.history.slice();
    return clone;
  }
}

CausalEngine.TILE_TYPES = TILE_TYPES;
CausalEngine.COLORS = COLORS;
CausalEngine.ICONS = ICONS;
CausalEngine.PAIR_TYPES = PAIR_TYPES;
CausalEngine.PRNG = PRNG;

module.exports = CausalEngine;
