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
const ShareManager = require('../../src/social/ShareManager.js');
const LeaderboardManager = require('../../src/social/LeaderboardManager.js');
const DailyChallenge = require('../../src/social/DailyChallenge.js');
const AdManager = require('../../src/monetization/AdManager.js');
const ItemManager = require('../../src/monetization/ItemManager.js');
const openDataContext = require('../../open-data-context/index.js');
const dailyChallengeCloud = require('../../cloud/functions/dailyChallenge/index.js');
const { bootstrap } = require('../../game.js');
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

{
  const share = new ShareManager();
  const pathData = {
    nodes: [
      { id: 'a', row: 0, col: 0, x: 10, y: 20, color: '#8DD7FF' },
      { id: 'b', row: 0, col: 1, x: 60, y: 20, color: '#FFD166' }
    ],
    edges: [{ from: 0, to: 1 }]
  };
  const result = { levelId: 7, moves: 12, minimumSteps: 10, stars: 2, backtracks: 1 };
  const payload = share.buildSharePayload(result, pathData);
  assert.equal(payload.data.levelId, 7);
  assert.equal(payload.data.pathNodeCount, 2);
  assert.equal(payload.data.trigger, 'clear');
  const card = await share.generatePathCard(result, pathData);
  assert.equal(card.width, 600);
  assert.equal(card.pathNodeCount, 2);
  const revivePayload = share.buildSharePayload({ levelId: 7, shareTrigger: 'share_revive' }, pathData);
  assert.ok(revivePayload.query.includes('trigger=share_revive'));
}

{
  const calls = [];
  const provinceCalls = [];
  const wxMock = {
    setUserCloudStorage(options) {
      calls.push(options.KVDataList);
      options.success({ ok: true });
    },
    cloud: {
      callFunction(options) {
        provinceCalls.push(options.data);
        options.success({ result: { rows: [{ rank: 1, bestMoves: 10 }] } });
      }
    }
  };
  const leaderboard = new LeaderboardManager({ wxApi: wxMock, storageKey: `test-${Date.now()}` });
  const first = await leaderboard.submitLevelResult({ levelId: 3, moves: 14, stars: 2, elapsedMs: 10000 });
  const second = await leaderboard.submitLevelResult({ levelId: 3, moves: 10, stars: 3, elapsedMs: 9000 });
  assert.equal(first.success, true);
  assert.equal(first.isPersonalBest, true);
  assert.equal(second.record.bestMoves, 10);
  assert.equal(second.record.stars, 3);
  assert.equal(second.isPersonalBest, true);
  assert.equal(second.previousRecord.bestMoves, 14);
  assert.equal(calls.length, 2);
  assert.equal(provinceCalls.length, 2);
  const rows = await leaderboard.getFriendLeaderboard(3);
  assert.equal(rows[0].bestMoves, 10);
  const provinceRows = await leaderboard.getProvinceLeaderboard(3);
  assert.equal(provinceRows[0].rank, 1);
}

{
  const posted = [];
  const wxMock = {
    getOpenDataContext() {
      return { postMessage: (message) => posted.push(message) };
    }
  };
  const leaderboard = new LeaderboardManager({ wxApi: wxMock, storageKey: `open-data-${Date.now()}` });
  const state = await leaderboard.showFriendLeaderboard(4, { width: 320, height: 360 });
  assert.equal(state.usesOpenDataContext, true);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].levelId, 4);
  assert.equal(posted[0].width, 320);
}

{
  const rows = openDataContext.normalizeRows(5, [{
    nickname: 'A',
    KVDataList: [
      { key: 'level_5_best_moves', value: '8' },
      { key: 'level_5_stars', value: '3' },
      { key: 'total_stars', value: '24' }
    ]
  }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].bestMoves, 8);
}

{
  const wxMock = {
    getFriendCloudStorage(options) {
      options.success({
        data: [{
          nickname: 'Friend A',
          KVDataList: [
            { key: 'level_6_best_moves', value: '13' },
            { key: 'level_6_stars', value: '3' },
            { key: 'total_stars', value: '30' }
          ]
        }]
      });
    },
    setUserCloudStorage(options) {
      options.success({ ok: true });
    }
  };
  const leaderboard = new LeaderboardManager({ wxApi: wxMock, storageKey: `friend-record-${Date.now()}` });
  const submit = await leaderboard.submitLevelResult({ levelId: 6, moves: 12, stars: 3, elapsedMs: 7000 });
  assert.equal(submit.beatFriendRecord, true);
  assert.equal(submit.friendBenchmark.bestMoves, 13);
  const share = new ShareManager();
  const payload = share.buildSharePayload({ levelId: 6, moves: 12, stars: 3, shareTrigger: 'friend_record' }, {});
  assert.ok(payload.title.includes('超越好友纪录'));
}

{
  const game = bootstrap({ autoStart: false, width: 375, height: 667 });
  assert.equal(game.getShareReviveRemaining(), 3);
  game.markShareReviveUsed();
  game.markShareReviveUsed();
  assert.equal(game.getShareReviveRemaining(), 1);
  game.markShareReviveUsed();
  assert.equal(game.canUseShareRevive(), false);
  game.stop();
}

{
  const adManager = new AdManager({
    mock: true,
    config: {
      cooldownMs: 0,
      interstitialCooldownMs: 0,
      interstitialEveryLevels: 5,
      mockDelayMs: 0
    }
  });
  const reward = await adManager.requestDoubleScore();
  assert.equal(reward.success, true);
  const skipped = await adManager.showInterstitialAfterLevel(4);
  assert.equal(skipped.success, false);
  assert.equal(skipped.reason, 'notScheduled');
  const shown = await adManager.showInterstitialAfterLevel(5);
  assert.equal(shown.success, true);
  await adManager.showResultBanner({ width: 375, height: 667 });
  assert.equal(adManager.getFillStats('rewarded').success, 1);
  assert.equal(adManager.getFillStats('interstitial').success, 1);
  assert.equal(adManager.getFillStats('banner').success, 1);
}

{
  let rewardedCloseHandler = null;
  const created = [];
  const wxMock = {
    createRewardedVideoAd(options) {
      created.push({ type: 'rewarded', adUnitId: options.adUnitId });
      return {
        onClose(handler) { rewardedCloseHandler = handler; },
        offClose(handler) {
          if (rewardedCloseHandler === handler) rewardedCloseHandler = null;
        },
        onError() {},
        load() { return Promise.resolve(); },
        show() {
          setTimeout(() => {
            if (rewardedCloseHandler) rewardedCloseHandler({ isEnded: true });
          }, 0);
          return Promise.resolve();
        }
      };
    },
    createInterstitialAd(options) {
      created.push({ type: 'interstitial', adUnitId: options.adUnitId });
      return { show: () => Promise.resolve() };
    },
    createBannerAd(options) {
      created.push({ type: 'banner', adUnitId: options.adUnitId, style: options.style });
      return {
        show: () => Promise.resolve(),
        hide: () => {}
      };
    }
  };
  const adManager = new AdManager({
    wxApi: wxMock,
    mock: false,
    config: {
      rewardedAdUnitId: 'rewarded-real-id',
      interstitialAdUnitId: 'interstitial-real-id',
      bannerAdUnitId: 'banner-real-id',
      cooldownMs: 0,
      interstitialCooldownMs: 0,
      interstitialEveryLevels: 5
    }
  });
  const revive = await adManager.requestRevive();
  assert.equal(revive.success, true);
  const interstitial = await adManager.showInterstitialAfterLevel(10);
  assert.equal(interstitial.success, true);
  const banner = await adManager.showResultBanner({ width: 375, height: 667 });
  assert.equal(banner.success, true);
  assert.ok(created.some((item) => item.type === 'rewarded' && item.adUnitId === 'rewarded-real-id'));
  assert.ok(created.some((item) => item.type === 'interstitial' && item.adUnitId === 'interstitial-real-id'));
  assert.ok(created.some((item) => item.type === 'banner' && item.adUnitId === 'banner-real-id'));
  assert.equal(adManager.getFillStats('rewarded').success, 1);
  assert.equal(adManager.getFillStats('interstitial').success, 1);
  assert.equal(adManager.getFillStats('banner').success, 1);
}

{
  const adManager = new AdManager({ mock: true, config: { cooldownMs: 0, mockDelayMs: 0 } });
  const items = new ItemManager({ adManager, inventory: { freeze: 0, reveal: 0, undo: 0, shuffle: 0 } });
  const levelGrant = items.startLevel(6);
  assert.equal(levelGrant.reveal, 1);
  const nullOptionsGrant = items.applyLevelGrants(3, null);
  assert.equal(nullOptionsGrant.reveal, 1);
  items.setInventory(null);
  assert.equal(typeof items.getInventory().reveal, 'number');
  const adGrant = await items.requestAdItem('shuffle');
  assert.equal(adGrant.success, true);
  assert.equal(items.getInventory().shuffle, 1);
  const dailyGrant = items.claimDailyChallengeReward({ reveal: 1, undo: 1 });
  assert.equal(dailyGrant.undo, 1);
}

{
  const daily = new DailyChallenge({ storageKey: `daily-${Date.now()}` });
  const challenge = await daily.getTodayChallenge(new Date('2026-05-08T00:00:00Z'));
  assert.equal(challenge.isDailyChallenge, true);
  assert.ok(challenge.seed.includes('2026-05-08'));
  const submit = await daily.submitResult({ dateKey: '2026-05-08', moves: 11, stars: 3, elapsedMs: 6000 });
  assert.equal(submit.ok, true);
  const rows = await daily.getNationalLeaderboard('2026-05-08');
  assert.equal(rows[0].rank, 1);
  const items = new ItemManager({ inventory: { freeze: 0, reveal: 0, undo: 0, shuffle: 0 } });
  const reward = daily.claimReward(items, '2026-05-08');
  assert.equal(reward.success, true);
  assert.equal(items.getInventory().reveal, 1);
  const duplicate = daily.claimReward(items, '2026-05-08');
  assert.equal(duplicate.reason, 'alreadyClaimed');
}

{
  const cloudChallenge = await dailyChallengeCloud.main({ action: 'getTodayChallenge', dateKey: '2026-05-08' });
  assert.equal(cloudChallenge.ok, true);
  assert.equal(cloudChallenge.challenge.seed, 'daily-2026-05-08-1454627708');
  const submit = await dailyChallengeCloud.main({
    action: 'submitResult',
    dateKey: '2026-05-08-cloud-test',
    openid: 'tester-a',
    moves: 9,
    stars: 3,
    elapsedMs: 5000
  });
  assert.equal(submit.ok, true);
  assert.equal(submit.rank, 1);
  const leaderboard = await dailyChallengeCloud.main({
    action: 'getNationalLeaderboard',
    dateKey: '2026-05-08-cloud-test'
  });
  assert.equal(leaderboard.ok, true);
  assert.equal(leaderboard.rows[0].openid, 'tester-a');
  assert.equal(leaderboard.rows[0].rank, 1);
}

console.log('core.test.mjs: all assertions passed');
