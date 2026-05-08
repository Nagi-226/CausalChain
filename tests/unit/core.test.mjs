import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const EventBus = require('../../src/utils/EventBus.js');
const Timer = require('../../src/utils/Timer.js');
const ObjectPool = require('../../src/utils/ObjectPool.js');
const CausalEngine = require('../../src/core/CausalEngine.js');
const BoardGenerator = require('../../src/core/BoardGenerator.js');
const BoardValidator = require('../../src/core/BoardValidator.js');
const Solver = require('../../src/core/Solver.js');
const levels = require('../../src/data/levels.json');
const themes = require('../../assets/themes/themes.json');

const makeEmptyBoard = () => Array.from({ length: 6 }, () => Array(8).fill(null));

const placePair = (board, from, to, color = 'crimson', icon = 'spark') => {
  board[from.row][from.col] = CausalEngine.createTile(
    CausalEngine.TILE_TYPES.CAUSE,
    color,
    icon,
    from.row,
    from.col,
    `cause-${from.row}-${from.col}-${color}-${icon}`
  );
  board[to.row][to.col] = CausalEngine.createTile(
    CausalEngine.TILE_TYPES.EFFECT,
    color,
    icon,
    to.row,
    to.col,
    `effect-${to.row}-${to.col}-${color}-${icon}`
  );
};

{
  const bus = new EventBus();
  let total = 0;
  const off = bus.on('score', (value) => {
    total += value;
  });
  bus.once('score', () => {
    total += 10;
  });
  assert.equal(bus.emit('score', 2), 2);
  assert.equal(bus.emit('score', 3), 1);
  off();
  assert.equal(bus.listenerCount('score'), 0);
  assert.equal(total, 15);
}

{
  const pool = new ObjectPool(() => ({ alive: false }), (item, phase) => {
    item.alive = phase === 'acquire';
  });
  const item = pool.acquire();
  assert.equal(item.alive, true);
  assert.equal(pool.release(item), true);
  assert.equal(item.alive, false);
  assert.deepEqual(pool.stats().active, 0);
}

{
  const timer = new Timer(() => {});
  assert.equal(timer.running, false);
  timer.setFPS(30).pause().resume().stop();
  assert.equal(timer.targetFPS, 30);
}

{
  assert.equal(levels.levels.length, 40, 'v0.0.6 should define 40 levels');
  assert.ok(themes.themes.star, 'star theme exists');
  assert.ok(themes.themes.ocean, 'ocean theme exists');

  const validator = new BoardValidator();
  for (const level of levels.levels) {
    const generated = BoardGenerator.generate({
      seed: level.seed,
      difficulty: {
        level: level.difficulty,
        fillRate: level.fillRate,
        chainLength: [level.generator.chainLength || 1, level.generator.chainLength || 1]
      }
    });
    assert.equal(validator.isSolvable(generated.board), true, `level ${level.id} should generate a solvable board`);
  }
}

{
  const validator = new BoardValidator();
  const generator = new BoardGenerator({ difficulty: 10, seed: 'batch' });
  for (let i = 0; i < 1000; i += 1) {
    const generated = generator.generate({ seed: `batch-${i}`, difficulty: (i % 10) + 1 });
    const validation = validator.validate(generated.board);
    assert.equal(validation.valid, true, `generated board ${i} should be structurally valid`);
    assert.equal(validator.hasLegalMove(generated.board), true, `generated board ${i} should have a legal pair`);
    assert.equal(validator.isSolvable(generated.board), true, `generated board ${i} should be solvable`);
  }
}

{
  const a = BoardGenerator.generate({ seed: 'same-seed', difficulty: 7 }).board;
  const b = BoardGenerator.generate({ seed: 'same-seed', difficulty: 7 }).board;
  assert.deepEqual(a, b, 'same seed and difficulty should reproduce the same board');
}

{
  const board = makeEmptyBoard();
  placePair(board, { row: 0, col: 0 }, { row: 0, col: 1 }, 'azure', 'moon');
  board[1][1] = CausalEngine.createTile(
    CausalEngine.TILE_TYPES.EFFECT,
    'gold',
    'leaf',
    1,
    1,
    'wrong-effect'
  );
  const engine = new CausalEngine({ board, seed: 'match-tests' });

  assert.equal(engine.canMatch({ row: 0, col: 0 }, { row: 0, col: 1 }).valid, true);
  assert.equal(engine.canMatch({ row: 0, col: 0 }, { row: 1, col: 1 }).reason, 'not_adjacent');
  assert.equal(engine.canMatch({ row: 0, col: 1 }, { row: 0, col: 0 }).reason, 'source_not_cause');

  const mismatchBoard = makeEmptyBoard();
  placePair(mismatchBoard, { row: 0, col: 0 }, { row: 0, col: 1 }, 'azure', 'moon');
  mismatchBoard[0][1].icon = 'leaf';
  mismatchBoard[0][1].pairKey = 'azure:leaf';
  const mismatchEngine = new CausalEngine({ board: mismatchBoard, seed: 'mismatch' });
  assert.equal(mismatchEngine.canMatch({ row: 0, col: 0 }, { row: 0, col: 1 }).reason, 'pair_mismatch');
}

{
  const board = makeEmptyBoard();
  placePair(board, { row: 2, col: 2 }, { row: 2, col: 3 });
  placePair(board, { row: 1, col: 2 }, { row: 1, col: 3 }, 'gold', 'leaf');
  const engine = new CausalEngine({ board, difficulty: 10, seed: 'freeze' });

  engine.freezeNextRewind();
  const frozen = engine.processMove({ row: 2, col: 2 }, { row: 2, col: 3 });
  assert.equal(frozen.success, true);
  assert.equal(frozen.move.rewindFrozen, true);
  assert.equal(frozen.move.rewindLayers.length, 0);
  assert.equal(engine.freezeNext, false);

  const next = engine.processMove({ row: 1, col: 2 }, { row: 1, col: 3 });
  assert.equal(next.success, true);
  assert.equal(next.move.rewindFrozen, false);
}

{
  const board = makeEmptyBoard();
  placePair(board, { row: 0, col: 0 }, { row: 0, col: 1 });
  const engine = new CausalEngine({ board, seed: 'undo' });
  const before = engine.getStateSnapshot();
  const move = engine.processMove({ row: 0, col: 0 }, { row: 0, col: 1 });
  assert.equal(move.success, true);
  assert.equal(engine.countTiles(), 0);
  assert.equal(engine.getStatus(), 'won');

  const undo = engine.undo();
  assert.equal(undo.success, true);
  assert.equal(engine.countTiles(), 2);
  assert.deepEqual(engine.board, before.board);
  assert.equal(engine.steps, before.steps);
}

{
  const generated = BoardGenerator.generate({ seed: 'solver-path', difficulty: 4 });
  const solver = new Solver();
  const result = solver.solve(generated.board);
  assert.equal(result.solved, true);
  assert.equal(result.path.length, result.minSteps);
  assert.equal(result.minSteps, generated.metadata.tileCount / 2);

  const engine = new CausalEngine({ board: generated.board, seed: 'solver-playback' });
  for (const step of result.path) {
    const played = engine.processMove(step.from, step.to, { freezeRewind: true });
    assert.equal(played.success, true);
  }
  assert.equal(engine.getStatus(), 'won');
}

{
  const generated = BoardGenerator.generate({
    seed: 'chain-links',
    difficulty: { level: 4, fillRate: 0.5, chainLength: [3, 3], rewindDepth: 2 }
  });
  const linkedMove = generated.solution.find((move) => {
    const tile = generated.board[move.from.row][move.from.col];
    return tile.causalLinks && tile.causalLinks.length > 0;
  });
  assert.ok(linkedMove, 'chain generation should annotate at least one linked pair');

  const engine = new CausalEngine({
    board: generated.board,
    difficulty: { level: 4, rewindDepth: 2 },
    seed: 'chain-playback'
  });
  const result = engine.processMove(linkedMove.from, linkedMove.to);
  const flatLayer = result.move.rewindLayers.flat();
  assert.equal(result.success, true);
  assert.ok(flatLayer.some((entry) => entry.relation === 'chain'), 'rewind layers should include chain relation');

  const insight = engine.getCausalInsight();
  assert.ok(Array.isArray(insight), 'causal insight returns path array');
  assert.ok(insight.length >= 2, 'causal insight contains at least one direct pair');
}

console.log('core.test.mjs: all assertions passed');
