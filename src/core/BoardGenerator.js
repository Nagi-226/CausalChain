const CausalEngine = require('./CausalEngine.js');
const Difficulty = require('./Difficulty.js');

class BoardGenerator {
  constructor(options = {}) {
    this.rows = options.rows || 6;
    this.cols = options.cols || 8;
    this.difficulty = Difficulty.normalize(options.difficulty || 1);
    this.seed = options.seed || Date.now();
    this.rng = new CausalEngine.PRNG(this.seed);
  }

  generate(options = {}) {
    const difficulty = Difficulty.normalize(options.difficulty || this.difficulty);
    const seed = options.seed || this.seed;
    const rng = new CausalEngine.PRNG(seed);
    const rows = options.rows || this.rows;
    const cols = options.cols || this.cols;
    const tileCount = Math.min(Difficulty.getTileCount(difficulty, rows, cols), rows * cols);
    const pairCount = tileCount / 2;
    const paradoxRatio = difficulty.paradoxRatio || 0;
    const crossLayerRatio = difficulty.crossLayerRatio || 0;
    const dominoes = this._makeDominoes(rows, cols);

    if (pairCount > dominoes.length) {
      throw new Error('BoardGenerator requires an even grid with enough adjacent domino slots');
    }

    rng.shuffle(dominoes);
    const selected = dominoes.slice(0, pairCount);
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const solution = [];

    for (let i = 0; i < selected.length; i += 1) {
      const pairType = CausalEngine.PAIR_TYPES[rng.int(CausalEngine.PAIR_TYPES.length)];
      const domino = selected[i];
      const causeFirst = rng.next() >= 0.5;
      const causePos = causeFirst ? domino[0] : domino[1];
      const effectPos = causeFirst ? domino[1] : domino[0];
      const pairId = `p${i}`;
      const cause = CausalEngine.createTile(
        CausalEngine.TILE_TYPES.CAUSE,
        pairType.color,
        pairType.icon,
        causePos.row,
        causePos.col,
        `${seed}-${pairId}-cause`
      );
      const effect = CausalEngine.createTile(
        CausalEngine.TILE_TYPES.EFFECT,
        pairType.color,
        pairType.icon,
        effectPos.row,
        effectPos.col,
        `${seed}-${pairId}-effect`
      );

      cause.pairId = pairId;
      effect.pairId = pairId;
      board[causePos.row][causePos.col] = cause;
      board[effectPos.row][effectPos.col] = effect;
      solution.push({
        from: { row: causePos.row, col: causePos.col },
        to: { row: effectPos.row, col: effectPos.col },
        pairKey: CausalEngine.getPairKey(cause),
        pairId
      });
    }

    this._annotateChains(board, solution, difficulty, rng);

    // paradox conversion: flip pairs to paradox type
    if (paradoxRatio > 0) {
      this._convertParadox(board, pairCount, paradoxRatio, rng);
    }

    // cross-layer links: add depth-2+ causalLinks within chains
    if (crossLayerRatio > 0) {
      this._annotateCrossLayer(board, solution, crossLayerRatio, rng);
    }

    return {
      board,
      rows,
      cols,
      seed,
      difficulty,
      solution,
      minSteps: solution.length,
      hasLegalMove: solution.length > 0,
      metadata: {
        generation: 'adjacent-reverse-domino-chain',
        fillRate: tileCount / (rows * cols),
        tileCount,
        pairCount,
        paradoxRatio,
        crossLayerRatio,
        chainRange: difficulty.chainLength || [1, 1]
      }
    };
  }

  generateBoard(options = {}) {
    return this.generate(options).board;
  }

  _makeDominoes(rows, cols) {
    const dominoes = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 2) {
        if (col + 1 < cols) {
          dominoes.push([
            { row, col },
            { row, col: col + 1 }
          ]);
        }
      }
    }
    return dominoes;
  }

  _annotateChains(board, solution, difficulty, rng) {
    const range = difficulty.chainLength || [1, 1];
    const minLength = Math.max(1, range[0] || 1);
    const maxLength = Math.max(minLength, range[1] || minLength);
    if (maxLength < 2 || solution.length < 2) return;

    const ordered = rng.shuffle(solution.slice());
    let cursor = 0;
    let chainIndex = 0;
    while (cursor < ordered.length) {
      const remaining = ordered.length - cursor;
      const length = Math.min(remaining, minLength + rng.int(maxLength - minLength + 1));
      if (length < 2) break;
      const chain = ordered.slice(cursor, cursor + length);
      const chainId = `chain-${chainIndex}`;
      for (let i = 0; i < chain.length; i += 1) {
        const entry = chain[i];
        const cause = board[entry.from.row][entry.from.col];
        const effect = board[entry.to.row][entry.to.col];
        for (const tile of [cause, effect]) {
          tile.chainId = chainId;
          tile.chainOrder = i;
          tile.chainCount = chain.length;
          tile.causalLinks = tile.causalLinks || [];
        }
        if (i < chain.length - 1) {
          const next = chain[i + 1];
          const link = {
            relation: 'chain',
            sourcePairId: entry.pairId,
            targetPairId: next.pairId,
            depth: i + 1
          };
          cause.causalLinks.push(link);
          effect.causalLinks.push(link);
        }
      }
      cursor += length;
      chainIndex += 1;
    }
  }

  _convertParadox(board, pairCount, paradoxRatio, rng) {
    const pairMap = new Map();
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const tile = board[row][col];
        if (!tile || !tile.pairId) continue;
        if (!pairMap.has(tile.pairId)) pairMap.set(tile.pairId, []);
        pairMap.get(tile.pairId).push(tile);
      }
    }

    const targetCount = Math.round(pairCount * paradoxRatio);
    const pairIds = Array.from(pairMap.keys());
    rng.shuffle(pairIds);

    let converted = 0;
    for (const pairId of pairIds) {
      if (converted >= targetCount) break;
      const tiles = pairMap.get(pairId);
      if (tiles.length !== 2) continue;
      for (const tile of tiles) {
        tile.type = CausalEngine.TILE_TYPES.PARADOX;
        tile.paradox = true;
      }
      converted += 1;
    }
  }

  _annotateCrossLayer(board, solution, crossLayerRatio, rng) {
    // find chains with length >= 3, add cross-layer links between non-adjacent pairs
    const byChain = new Map();
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const tile = board[row][col];
        if (!tile || !tile.chainId) continue;
        if (!byChain.has(tile.chainId)) byChain.set(tile.chainId, new Map());
        const chainPairs = byChain.get(tile.chainId);
        const pairId = tile.pairId;
        if (!chainPairs.has(pairId)) chainPairs.set(pairId, tile);
      }
    }

    for (const [chainId, pairTiles] of byChain) {
      const pairs = Array.from(pairTiles.entries());
      if (pairs.length < 3) continue;

      for (let i = 0; i < pairs.length; i += 1) {
        for (let j = i + 2; j < pairs.length; j += 1) {
          if (rng.next() > crossLayerRatio) continue;
          const depth = j - i;
          const srcPairId = pairs[i][0];
          const tgtPairId = pairs[j][0];
          const link = {
            relation: 'cross-chain',
            sourcePairId: srcPairId,
            targetPairId: tgtPairId,
            depth
          };
          const srcTile = pairs[i][1];
          if (srcTile) {
            srcTile.causalLinks = srcTile.causalLinks || [];
            srcTile.causalLinks.push(link);
          }
        }
      }
    }
  }

  static generate(options = {}) {
    return new BoardGenerator(options).generate(options);
  }
}

module.exports = BoardGenerator;
