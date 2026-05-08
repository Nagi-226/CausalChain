const BoardRenderer = safeRequire('./src/render/BoardRenderer', null);
const TileAnimator = safeRequire('./src/render/TileAnimator', null);
const EffectRenderer = safeRequire('./src/render/EffectRenderer', null);
const CausalPathRenderer = safeRequire('./src/render/CausalPathRenderer', null);
const TouchHandler = safeRequire('./src/input/TouchHandler', null);

const CoreCausalEngine = safeRequire('./src/core/CausalEngine', null);
const CoreBoardGenerator = safeRequire('./src/core/BoardGenerator', null);

const HUD = safeRequire('./src/ui/HUD', NullWidget);
const Toolbar = safeRequire('./src/ui/Toolbar', NullWidget);
const Tutorial = safeRequire('./src/ui/Tutorial', NullWidget);
const MenuManager = safeRequire('./src/ui/MenuManager', NullWidget);
const ResultPanel = safeRequire('./src/ui/ResultPanel', NullWidget);
const AdManager = safeRequire('./src/monetization/AdManager', null);
const ItemManager = safeRequire('./src/monetization/ItemManager', null);
const ShareManager = safeRequire('./src/social/ShareManager', null);
const LeaderboardManager = safeRequire('./src/social/LeaderboardManager', null);
const DailyChallenge = safeRequire('./src/social/DailyChallenge', null);
const LEVELS_DATA = safeJsonRequire('./src/data/levels.json', { levels: [] });
const TUTORIALS_DATA = safeJsonRequire('./src/data/tutorials.json', { tutorials: {} });
const STRINGS = safeJsonRequire('./src/data/strings.json', {});
const THEME_DATA = safeJsonRequire('./assets/themes/themes.json', { themes: {} });

const BOARD_COLS = 8;
const BOARD_ROWS = 6;
const GAME_MEMORY_STORAGE = {};

function safeRequire(path, fallback) {
  try {
    if (typeof require !== 'function') {
      return fallback;
    }
    const mod = require(path);
    if (!mod) {
      return fallback;
    }
    if (typeof mod === 'function') {
      return mod;
    }
    if (mod.default) {
      return mod.default;
    }
    const name = path.split('/').pop().replace(/\.js$/, '');
    if (mod[name]) {
      return mod[name];
    }
    const keys = Object.keys(mod);
    for (let i = 0; i < keys.length; i += 1) {
      if (typeof mod[keys[i]] === 'function') {
        return mod[keys[i]];
      }
    }
    return fallback;
  } catch (error) {
    return fallback;
  }
}

function safeJsonRequire(path, fallback) {
  try {
    if (typeof require !== 'function') return fallback;
    return require(path) || fallback;
  } catch (error) {
    return fallback;
  }
}

function NullWidget() {}
NullWidget.prototype.update = function update() {};
NullWidget.prototype.draw = function draw() {};
NullWidget.prototype.show = function show() {};
NullWidget.prototype.hide = function hide() {};
NullWidget.prototype.setState = function setState() {};
NullWidget.prototype.handleTouch = function handleTouch() { return false; };

class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(name, fn) {
    if (!this.listeners[name]) {
      this.listeners[name] = [];
    }
    this.listeners[name].push(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    const list = this.listeners[name];
    if (!list) {
      return;
    }
    const index = list.indexOf(fn);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  emit(name, payload) {
    const list = this.listeners[name] || [];
    for (let i = 0; i < list.length; i += 1) {
      list[i](payload);
    }
  }
}

class FallbackBoardGenerator {
  constructor(options) {
    this.cols = (options && options.cols) || BOARD_COLS;
    this.rows = (options && options.rows) || BOARD_ROWS;
    this.colors = ['red', 'blue', 'green'];
    this.icons = ['spark', 'moon', 'seed'];
  }

  generate() {
    const tiles = [];
    let id = 1;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 2) {
        const color = this.colors[(row + col) % this.colors.length];
        const icon = this.icons[(row * 2 + col) % this.icons.length];
        const pairId = 'p' + id;
        tiles.push({
          id: 'c' + id,
          pairId,
          row,
          col,
          type: 'cause',
          color,
          icon,
          removed: false
        });
        tiles.push({
          id: 'e' + id,
          pairId,
          row,
          col: col + 1,
          type: 'effect',
          color,
          icon,
          removed: false
        });
        id += 1;
      }
    }
    return { cols: this.cols, rows: this.rows, tiles };
  }
}

class FallbackCausalEngine {
  constructor(options) {
    const opts = options || {};
    this.board = opts.board || new FallbackBoardGenerator(opts).generate();
    this.state = {
      level: 1,
      moves: 0,
      rewinds: 0,
      status: 'playing',
      startedAt: now()
    };
    this.events = new EventBus();
  }

  getTileAt(row, col) {
    const tiles = this.board.tiles || flattenBoardTiles(this.board);
    for (let i = 0; i < tiles.length; i += 1) {
      const tile = tiles[i];
      if (!tile.removed && tile.row === row && tile.col === col) {
        return tile;
      }
    }
    return null;
  }

  attemptMove(input, maybeTarget) {
    const from = input && input.from ? input.from : input;
    const to = input && input.to ? input.to : maybeTarget;
    const cause = input && input.causeTile ? input.causeTile : this.getTileAt(from.row, from.col);
    const effect = input && input.effectTile ? input.effectTile : this.getTileAt(to.row, to.col);
    const adjacent = Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
    const matching = cause && effect && cause.type === 'cause' && effect.type === 'effect' &&
      cause.color === effect.color && cause.icon === effect.icon;

    if (!adjacent || !matching) {
      const failed = { success: false, valid: false, causeTile: cause, effectTile: effect };
      this.events.emit('move:invalid', failed);
      return failed;
    }

    cause.removed = true;
    effect.removed = true;
    this.state.moves += 1;
    const origin = {
      row: (cause.row + effect.row) / 2,
      col: (cause.col + effect.col) / 2
    };
    const backtrackLayers = this.collectBacktrackLayers(cause, effect);
    const success = {
      success: true,
      valid: true,
      eliminated: [cause, effect],
      removedTiles: [cause, effect],
      causeTile: cause,
      effectTile: effect,
      origin,
      backtrackLayers,
      completed: this.isCleared()
    };
    if (success.completed) {
      this.state.status = 'completed';
    }
    this.events.emit('move:success', success);
    if (success.completed) {
      this.events.emit('level:complete', success);
    }
    return success;
  }

  collectBacktrackLayers(cause, effect) {
    const seeds = [{ row: cause.row, col: cause.col }, { row: effect.row, col: effect.col }];
    const layers = [];
    const seen = {};
    for (let depth = 0; depth < 3; depth += 1) {
      const layer = [];
      const radius = depth + 1;
      for (let i = 0; i < seeds.length; i += 1) {
        const seed = seeds[i];
        const dirs = [
          { row: seed.row - radius, col: seed.col },
          { row: seed.row + radius, col: seed.col },
          { row: seed.row, col: seed.col - radius },
          { row: seed.row, col: seed.col + radius }
        ];
        for (let d = 0; d < dirs.length; d += 1) {
          const pos = dirs[d];
          const key = pos.row + ':' + pos.col;
          const tile = this.getTileAt(pos.row, pos.col);
          if (tile && !seen[key]) {
            seen[key] = true;
            layer.push(tile);
          }
        }
      }
      if (layer.length) {
        layers.push(layer);
      }
    }
    return layers;
  }

  isCleared() {
    const tiles = this.board.tiles || flattenBoardTiles(this.board);
    for (let i = 0; i < tiles.length; i += 1) {
      if (!tiles[i].removed) {
        return false;
      }
    }
    return true;
  }
}

function flattenBoardTiles(board) {
  if (!Array.isArray(board)) {
    return [];
  }
  const tiles = [];
  for (let row = 0; row < board.length; row += 1) {
    const line = board[row];
    if (!Array.isArray(line)) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      const tile = line[col];
      if (tile) {
        if (tile.row === undefined) {
          tile.row = row;
        }
        if (tile.col === undefined) {
          tile.col = col;
        }
        tiles.push(tile);
      }
    }
  }
  return tiles;
}

class CausalChainGame {
  constructor(options) {
    this.options = options || {};
    this.wx = this.options.wx || this.options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.canvasInfo = createCanvas(this.wx, this.options);
    this.canvas = this.canvasInfo.canvas;
    this.ctx = this.canvasInfo.ctx;
    this.width = this.canvasInfo.width;
    this.height = this.canvasInfo.height;
    this.dpr = this.canvasInfo.dpr;
    this.running = false;
    this.lastFrame = 0;
    this.rafId = 0;
    this.currentLevelId = this.options.levelId || 1;
    this.currentLevel = getLevelDefinition(this.currentLevelId);
    this.currentTheme = getThemeDefinition(this.currentLevel.theme);
    this.startedAt = now();
    this.levelCompleted = false;
    this.lastCompletedResult = null;
    this.shareReviveKey = 'ccgs.shareRevive.v0';
    this.shareReviveLimit = 3;

    this.board = this.createBoard();
    this.engine = this.createEngine(this.board);
    this.adManager = AdManager ? new AdManager({ wxApi: this.wx, mock: !this.wx }) : null;
    this.itemManager = ItemManager ? new ItemManager({ adManager: this.adManager }) : null;
    this.shareManager = ShareManager ? new ShareManager({ wxApi: this.wx, appTitle: 'Causal Chain' }) : null;
    this.leaderboardManager = LeaderboardManager ? new LeaderboardManager({ wxApi: this.wx }) : null;
    this.dailyChallenge = DailyChallenge ? new DailyChallenge({ wxApi: this.wx }) : null;
    if (this.itemManager && typeof this.itemManager.startLevel === 'function') {
      this.itemManager.startLevel(this.currentLevelId, { grants: this.currentLevel.rewards || null });
    }
    this.animator = new TileAnimator({ clock: now });
    this.effects = new EffectRenderer();
    this.pathRenderer = new CausalPathRenderer();
    this.boardRenderer = new BoardRenderer(this.ctx, {
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      animator: this.animator,
      effectRenderer: this.effects,
      pathRenderer: this.pathRenderer
    });
    this.boardRenderer.setCanvasSize(this.width, this.height, this.dpr);
    this.boardRenderer.setTheme(this.currentTheme);
    this.boardRenderer.setBoard(this.getBoard());

    this.hud = new HUD({ game: this, engine: this.engine, strings: STRINGS, width: this.width, height: this.height });
    this.toolbar = new Toolbar({ game: this, engine: this.engine, strings: STRINGS, width: this.width, height: this.height });
    this.tutorial = new Tutorial({ game: this, engine: this.engine, strings: STRINGS, tutorials: TUTORIALS_DATA, width: this.width, height: this.height });
    this.menu = new MenuManager({ game: this, engine: this.engine, strings: STRINGS, levels: LEVELS_DATA.levels || [], width: this.width, height: this.height });
    this.resultPanel = new ResultPanel({ game: this, engine: this.engine, strings: STRINGS, width: this.width, height: this.height });
    this.layoutWidgets();

    this.touch = new TouchHandler(this.canvas, this.boardRenderer, this.engine, this.animator, this.effects, {
      onMoveResult: (result) => this.handleMoveResult(result),
      onDragChange: (drag) => this.boardRenderer.setDragState(drag),
      onTap: (point) => this.handleTap(point.x, point.y)
    });

    this.bindEngineEvents();
    this.touch.attach();
  }

  createBoard() {
    const Generator = CoreBoardGenerator || FallbackBoardGenerator;
    let generator;
    try {
      generator = new Generator({
        cols: BOARD_COLS,
        rows: BOARD_ROWS,
        level: this.currentLevelId,
        difficulty: this.getLevelDifficultyConfig(),
        seed: this.currentLevel.seed || `level-${this.currentLevelId}`
      });
      if (typeof generator.generate === 'function') {
        const generated = generator.generate({
          cols: BOARD_COLS,
          rows: BOARD_ROWS,
          level: this.currentLevelId,
          difficulty: this.getLevelDifficultyConfig(),
          seed: this.currentLevel.seed || `level-${this.currentLevelId}`
        });
        return generated && generated.board ? generated.board : generated;
      }
    } catch (error) {
      generator = new FallbackBoardGenerator({ cols: BOARD_COLS, rows: BOARD_ROWS });
    }
    return generator.generate();
  }

  createEngine(board) {
    const Engine = CoreCausalEngine || FallbackCausalEngine;
    try {
      return new Engine({ board, cols: BOARD_COLS, rows: BOARD_ROWS, level: this.currentLevelId, difficulty: this.getLevelDifficultyConfig() });
    } catch (error) {
      return new FallbackCausalEngine({ board, cols: BOARD_COLS, rows: BOARD_ROWS });
    }
  }

  layoutWidgets() {
    const safeTop = 0;
    const safeBottom = 0;
    callWidget(this.hud, 'setLayout', this.width, this.height, safeTop);
    callWidget(this.toolbar, 'setLayout', this.width, this.height, safeBottom);
    callWidget(this.tutorial, 'setLayout', this.width, this.height, {
      boardRect: this.boardRenderer.getBoardRect(),
      cellSize: this.boardRenderer.layout.cell
    });
    callWidget(this.menu, 'setLayout', this.width, this.height);
    callWidget(this.resultPanel, 'setLayout', this.width, this.height);
  }

  getLevelDifficultyConfig() {
    const generator = this.currentLevel.generator || {};
    return {
      level: this.currentLevel.difficulty || 1,
      fillRate: this.currentLevel.fillRate,
      chainLength: [Math.max(1, generator.chainLength || 1), Math.max(1, generator.chainLength || 1)]
    };
  }

  getBoard() {
    return (this.engine && this.engine.board) || this.board;
  }

  bindEngineEvents() {
    const events = this.getEngineEvents();
    if (!events || typeof events.on !== 'function') {
      return;
    }
    events.on('level:complete', (payload) => {
      this.showLevelComplete(payload);
    });
    events.on('match:success', (payload) => {
      if (payload && payload.status === 'won') {
        this.showLevelComplete(payload);
      }
    });
  }

  handleMoveResult(result) {
    if (!result || !result.success) {
      return;
    }
    this.pathRenderer.recordMove(result, this.boardRenderer);
    if (result.completed || result.status === 'won') {
      this.showLevelComplete(result);
    } else if (result.status === 'lost') {
      this.resultPanel.show('fail', this.buildResultState(result));
    }
  }

  getEngineEvents() {
    return (this.engine && (this.engine.events || this.engine.eventBus)) || null;
  }

  getEngineState() {
    if (this.engine && typeof this.engine.getStateSnapshot === 'function') {
      return this.engine.getStateSnapshot({ includeHistory: false });
    }
    return (this.engine && this.engine.state) || {};
  }

  buildHudState() {
    const state = this.getEngineState();
    return {
      levelId: this.currentLevelId,
      status: normalizeStatus(state.status),
      moves: state.steps || state.moves || 0,
      minimumSteps: this.currentLevel.minimumSteps || state.minimumSteps || 0,
      elapsedMs: now() - this.startedAt,
      backtracks: state.rewindCount || state.rewinds || state.backtracks || 0
    };
  }

  buildResultState(result) {
    const hud = this.buildHudState();
    const mode = result && result.status === 'lost' ? 'fail' : 'win';
    const stars = calculateStars(hud.moves, hud.minimumSteps, mode);
    return {
      levelId: hud.levelId,
      moves: hud.moves,
      minimumSteps: hud.minimumSteps,
      elapsedMs: hud.elapsedMs,
      backtracks: hud.backtracks,
      stars,
      reason: result && result.reason ? result.reason : 'noMoves',
      canShareRevive: mode === 'fail' && this.canUseShareRevive(),
      shareReviveRemaining: this.getShareReviveRemaining()
    };
  }

  showLevelComplete(result) {
    const resultState = this.buildResultState(result);
    if (this.levelCompleted) {
      if (this.resultPanel && typeof this.resultPanel.show === 'function') {
        this.resultPanel.show('win', this.lastCompletedResult || resultState);
      }
      return;
    }
    if (!this.levelCompleted) {
      this.levelCompleted = true;
      const wasCleared = Boolean(this.menu && this.menu.progress && this.menu.progress.stars &&
        this.menu.progress.stars[resultState.levelId]);
      resultState.shareTrigger = this.resolveCompletionShareTrigger(resultState, wasCleared, null);
      this.lastCompletedResult = resultState;
      this.effects.playCelebration(this.boardRenderer.getBoardRect());
      if (this.menu && typeof this.menu.setLevelResult === 'function' && !this.currentLevel.isDailyChallenge) {
        this.menu.setLevelResult(resultState.levelId, resultState);
      }
      if (this.leaderboardManager && typeof this.leaderboardManager.submitLevelResult === 'function') {
        this.leaderboardManager.submitLevelResult(resultState).then((submitState) => {
          const shareTrigger = this.resolveCompletionShareTrigger(resultState, wasCleared, submitState);
          resultState.shareTrigger = shareTrigger;
          this.lastCompletedResult = resultState;
          if (this.resultPanel && typeof this.resultPanel.update === 'function') {
        this.resultPanel.update({
              shareTrigger,
              personalBest: submitState && submitState.isPersonalBest,
              beatFriendRecord: submitState && submitState.beatFriendRecord
            });
          }
        }).catch(() => {});
      }
      if (this.currentLevel && this.currentLevel.isDailyChallenge && this.dailyChallenge) {
        this.dailyChallenge.submitResult({ ...resultState, dateKey: this.currentLevel.dateKey }).then((dailyState) => {
          const reward = this.dailyChallenge.claimReward(this.itemManager, this.currentLevel.dateKey);
          if (this.resultPanel && typeof this.resultPanel.update === 'function') {
            this.resultPanel.update({
              dailyRank: dailyState.rank || null,
              dailyReward: reward && reward.success ? reward.granted : null
            });
          }
        }).catch(() => {});
      }
      if (this.adManager && typeof this.adManager.showInterstitialAfterLevel === 'function') {
        this.adManager.showInterstitialAfterLevel(resultState.levelId).catch(() => {});
      }
    }
    if (this.resultPanel && typeof this.resultPanel.show === 'function') {
      this.resultPanel.show('win', resultState);
    }
    this.showResultBanner();
  }

  resolveCompletionShareTrigger(resultState, wasCleared, submitState) {
    if (submitState && submitState.beatFriendRecord) {
      return 'friend_record';
    }
    if (submitState && submitState.isPersonalBest && submitState.previousRecord) {
      return 'new_record';
    }
    if (!wasCleared && Number(resultState.levelId) <= 10) {
      return 'first_ten_clear';
    }
    return 'clear';
  }

  handleTap(x, y) {
    const commands = [
      callWidget(this.resultPanel, 'handleTap', x, y),
      callWidget(this.tutorial, 'handleTap', x, y),
      callWidget(this.menu, 'handleTap', x, y),
      callWidget(this.toolbar, 'handleTap', x, y),
      callWidget(this.hud, 'handleTap', x, y)
    ];
    for (let i = 0; i < commands.length; i += 1) {
      if (commands[i]) {
        this.handleCommand(commands[i]);
        return true;
      }
    }
    return false;
  }

  handleCommand(command) {
    if (!command) return;
    if (command.type === 'menu.action') {
      if (command.action === 'start' || command.action === 'resume') this.menu.hide();
      if (command.action === 'restart') this.restartLevel();
      if (command.action === 'leaderboard') this.showLeaderboard();
      if (command.action === 'dailyChallenge') this.startDailyChallenge();
      return;
    }
    if (command.type === 'menu.level' && !command.locked) {
      this.loadLevel(command.levelId);
      this.menu.hide();
      return;
    }
    if (command.type === 'hud.pause') {
      this.menu.show('paused');
      return;
    }
    if (command.type === 'toolbar.itemTap' && !command.disabled) {
      this.useToolbarItem(command.itemId);
      return;
    }
    if (command.type === 'result.action') {
      if (command.action === 'retry' || command.action === 'restart') this.restartLevel();
      if (command.action === 'next') this.loadLevel(this.currentLevelId + 1);
      if (command.action === 'undo') this.undoLastMove();
      if (command.action === 'adRevive') this.adRevive();
      if (command.action === 'share') this.shareCurrentResult(command.result);
      if (command.action === 'shareRevive') this.shareDeadlockRevive(command.result);
      if (command.action === 'doubleReward') this.doubleReward(command.result);
    }
  }

  showLeaderboard() {
    if (this.menu && typeof this.menu.show === 'function') {
      this.menu.show('leaderboard');
    }
    if (!this.leaderboardManager || typeof this.leaderboardManager.showFriendLeaderboard !== 'function') {
      return;
    }
    this.leaderboardManager.showFriendLeaderboard(this.currentLevelId).then((state) => {
      callWidget(this.menu, 'update', {
        leaderboardState: {
          levelId: this.currentLevelId,
          rows: state.rows || [],
          usesOpenDataContext: Boolean(state.usesOpenDataContext)
        }
      });
    });
  }

  shareCurrentResult(result) {
    if (!this.shareManager || typeof this.shareManager.shareResult !== 'function') {
      return;
    }
    const shareResult = {
      ...this.buildResultState(result || {}),
      ...(result || {})
    };
    if (this.leaderboardManager && typeof this.leaderboardManager.getRankingPercent === 'function') {
      shareResult.rankingPercent = this.leaderboardManager.getRankingPercent(shareResult.levelId, shareResult.moves);
    }
    const pathData = this.exportSharePathData();
    this.shareManager.shareResult(shareResult, pathData);
  }

  shareDeadlockRevive(result) {
    if (!this.canUseShareRevive() || !this.shareManager || typeof this.shareManager.shareResult !== 'function') {
      return;
    }
    const shareResult = {
      ...this.buildResultState({ status: 'lost' }),
      ...(result || {}),
      shareTrigger: 'share_revive'
    };
    this.shareManager.shareResult(shareResult, this.exportSharePathData()).then(() => {
      this.markShareReviveUsed();
      const undoResult = this.undoLastMove();
      if (!undoResult || undoResult.success !== false) {
        callWidget(this.resultPanel, 'hide');
      }
    }).catch(() => {});
  }

  adRevive() {
    if (!this.adManager || typeof this.adManager.requestRevive !== 'function') {
      this.useToolbarItem('freeze');
      return;
    }
    this.adManager.requestRevive().then((adResult) => {
      if (!adResult || !adResult.success) return;
      const undoResult = this.undoLastMove();
      if (!undoResult || undoResult.success !== false) {
        callWidget(this.resultPanel, 'hide');
      }
    }).catch(() => {});
  }

  doubleReward(result) {
    if (!this.adManager || typeof this.adManager.requestDoubleScore !== 'function') return;
    this.adManager.requestDoubleScore().then((adResult) => {
      if (!adResult || !adResult.success) return;
      if (this.itemManager && typeof this.itemManager.grantItems === 'function') {
        this.itemManager.grantItems({ reveal: 1 });
      }
      callWidget(this.resultPanel, 'update', {
        ...(result || {}),
        doubleRewardClaimed: true,
        rewardMultiplier: 2
      });
    }).catch(() => {});
  }

  showResultBanner() {
    if (this.adManager && typeof this.adManager.showResultBanner === 'function') {
      this.adManager.showResultBanner({ width: this.width, height: this.height }).catch(() => {});
    }
  }

  exportSharePathData() {
    const history = this.pathRenderer && typeof this.pathRenderer.getHistory === 'function'
      ? this.pathRenderer.getHistory()
      : [];
    if (history.length > 0) {
      return history[history.length - 1];
    }
    if (this.pathRenderer && typeof this.pathRenderer.exportPathData === 'function') {
      return this.pathRenderer.exportPathData(this.getCausalInsight(), this.boardRenderer, {
        source: 'share',
        createdAt: Date.now()
      });
    }
    return { nodes: [], edges: [] };
  }

  useToolbarItem(itemId) {
    if (!this.itemManager || typeof this.itemManager.useItem !== 'function') return;
    this.itemManager.useItem(itemId, this, { allowAd: true }).then((result) => {
      if (result && result.success && itemId === 'reveal') {
        this.pathRenderer.setPath(result.effect && result.effect.value ? result.effect.value : this.getCausalInsight());
      }
    });
  }

  freezeBacktrack() {
    if (this.engine && typeof this.engine.freezeNextRewind === 'function') return this.engine.freezeNextRewind();
    return false;
  }

  revealPath() {
    const path = this.getCausalInsight();
    if (this.pathRenderer && typeof this.pathRenderer.setPath === 'function') {
      this.pathRenderer.setPath(path);
    }
    return path;
  }

  undoLastMove() {
    if (this.engine && typeof this.engine.undo === 'function') {
      const result = this.engine.undo();
      if (!result || result.success !== false) {
        callWidget(this.resultPanel, 'hide');
      }
      return result;
    }
    return false;
  }

  canUseShareRevive() {
    return this.getShareReviveRemaining() > 0;
  }

  markShareReviveUsed() {
    const state = this.getShareReviveState();
    state.count += 1;
    this.setStoredValue(this.shareReviveKey, state);
  }

  getShareReviveState() {
    const today = getLocalDateKey();
    const stored = this.getStoredValue(this.shareReviveKey);
    if (stored && typeof stored === 'object' && stored.date === today) {
      return { date: today, count: Number(stored.count || 0) };
    }
    if (stored === today) {
      return { date: today, count: 1 };
    }
    return { date: today, count: 0 };
  }

  getShareReviveRemaining() {
    const state = this.getShareReviveState();
    return Math.max(0, this.shareReviveLimit - state.count);
  }

  getStoredValue(key) {
    if (this.wx && typeof this.wx.getStorageSync === 'function') {
      return this.wx.getStorageSync(key);
    }
    return GAME_MEMORY_STORAGE[key];
  }

  setStoredValue(key, value) {
    if (this.wx && typeof this.wx.setStorageSync === 'function') {
      this.wx.setStorageSync(key, value);
      return;
    }
    GAME_MEMORY_STORAGE[key] = value;
  }

  shuffleBoard() {
    if (this.engine && typeof this.engine.reshuffle === 'function') return this.engine.reshuffle();
    return false;
  }

  getCausalInsight() {
    if (this.engine && typeof this.engine.getCausalInsight === 'function') return this.engine.getCausalInsight();
    return [];
  }

  restartLevel() {
    this.loadLevel(this.currentLevelId);
  }

  loadLevel(levelId) {
    this.currentLevelId = Math.max(1, Math.min(levelId, (LEVELS_DATA.levels || []).length || levelId));
    this.loadLevelDefinition(getLevelDefinition(this.currentLevelId));
  }

  loadLevelDefinition(levelDefinition) {
    this.currentLevel = levelDefinition;
    this.currentLevelId = levelDefinition.id || levelDefinition.levelId || this.currentLevelId;
    this.currentTheme = getThemeDefinition(this.currentLevel.theme);
    this.startedAt = now();
    this.levelCompleted = false;
    this.lastCompletedResult = null;
    this.board = this.createBoard();
    this.engine = this.createEngine(this.board);
    if (this.touch) {
      this.touch.engine = this.engine;
    }
    this.bindEngineEvents();
    this.boardRenderer.setBoard(this.getBoard());
    this.boardRenderer.setTheme(this.currentTheme);
    this.resultPanel.hide();
    if (this.itemManager && typeof this.itemManager.startLevel === 'function') {
      this.itemManager.startLevel(this.currentLevelId, { grants: this.currentLevel.rewards || null });
    }
    if (this.adManager && typeof this.adManager.hideBanner === 'function') {
      this.adManager.hideBanner();
    }
  }

  startDailyChallenge() {
    if (!this.dailyChallenge || typeof this.dailyChallenge.getTodayChallenge !== 'function') return Promise.resolve(null);
    return this.dailyChallenge.getTodayChallenge().then((challenge) => {
      this.loadLevelDefinition({ ...challenge, id: challenge.levelId, isDailyChallenge: true });
      if (this.menu && typeof this.menu.hide === 'function') this.menu.hide();
      return challenge;
    }).catch(() => {});
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastFrame = now();
    this.loop(this.lastFrame);
  }

  stop() {
    this.running = false;
    cancelFrame(this.rafId);
    this.touch.detach();
  }

  loop(time) {
    if (!this.running) {
      return;
    }
    const current = time || now();
    const dt = Math.min(50, current - this.lastFrame || 16.67);
    this.lastFrame = current;
    this.update(dt, current);
    this.draw(current);
    this.rafId = requestFrame((next) => this.loop(next));
  }

  update(dt, time) {
    this.animator.update(time);
    this.effects.update(dt, time);
    const hudState = this.buildHudState();
    callWidget(this.hud, 'update', hudState);
    callWidget(this.toolbar, 'update', this.itemManager && this.itemManager.getToolbarState ? this.itemManager.getToolbarState() : {});
    callWidget(this.menu, 'update', {});
    callWidget(this.tutorial, 'update', dt, hudState);
    this.boardRenderer.setBoard(this.getBoard());
  }

  draw(time) {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    drawBackground(ctx, this.width, this.height, time, this.currentTheme);
    ctx.restore();

    this.boardRenderer.draw({
      time,
      state: this.getEngineState()
    });

    const state = this.getEngineState();
    callWidget(this.hud, 'draw', ctx, this.width, this.height, state);
    callWidget(this.toolbar, 'draw', ctx, this.width, this.height, state);
    callWidget(this.tutorial, 'draw', ctx, this.width, this.height, state);
    callWidget(this.menu, 'draw', ctx, this.width, this.height, state);
    if (this.menu && this.menu.visible && this.menu.screen === 'leaderboard' &&
      this.leaderboardManager && typeof this.leaderboardManager.drawOpenDataContext === 'function') {
      this.leaderboardManager.drawOpenDataContext(ctx, 28, 168, this.width - 56, Math.min(420, this.height - 220));
    }
    callWidget(this.resultPanel, 'draw', ctx, this.width, this.height, state);
  }
}

function callWidget(widget, method) {
  if (widget && typeof widget[method] === 'function') {
    const args = Array.prototype.slice.call(arguments, 2);
    return widget[method].apply(widget, args);
  }
  return null;
}

function getLevelDefinition(levelId) {
  const levels = LEVELS_DATA.levels || [];
  for (let i = 0; i < levels.length; i += 1) {
    if (Number(levels[i].id) === Number(levelId)) return levels[i];
  }
  return {
    id: levelId,
    seed: `level-${levelId}`,
    difficulty: 1,
    minimumSteps: 12,
    rewards: null
  };
}

function getThemeDefinition(themeId) {
  const themes = THEME_DATA.themes || {};
  return themes[themeId] || themes.star || {
    background: ['#111827', '#172554', '#0f172a'],
    panel: 'rgba(15,23,42,0.58)',
    grid: 'rgba(2,6,23,0.34)'
  };
}

function normalizeStatus(status) {
  if (status === 'won' || status === 'completed') return 'win';
  if (status === 'lost') return 'fail';
  return status || 'playing';
}

function calculateStars(moves, minimumSteps, mode) {
  if (mode === 'fail') return 0;
  if (!minimumSteps || moves <= minimumSteps) return 3;
  if (moves <= minimumSteps + 3) return 2;
  return 1;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createCanvas(wxApi, options) {
  const dpr = getDevicePixelRatio(wxApi);
  const size = getViewportSize(wxApi, options);
  let canvas = null;

  if (wxApi && typeof wxApi.createCanvas === 'function') {
    canvas = wxApi.createCanvas();
  } else if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas');
    if (document.body && !canvas.parentNode) {
      document.body.appendChild(canvas);
    }
  } else {
    canvas = createMockCanvas();
  }

  canvas.width = Math.floor(size.width * dpr);
  canvas.height = Math.floor(size.height * dpr);
  canvas.style = canvas.style || {};
  canvas.style.width = size.width + 'px';
  canvas.style.height = size.height + 'px';

  const ctx = canvas.getContext ? canvas.getContext('2d') : createMockContext();
  if (ctx && typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else if (ctx && typeof ctx.scale === 'function') {
    ctx.scale(dpr, dpr);
  }

  return {
    canvas,
    ctx,
    width: size.width,
    height: size.height,
    dpr
  };
}

function getViewportSize(wxApi, options) {
  const fallback = {
    width: (options && options.width) || 375,
    height: (options && options.height) || 667
  };
  if (!wxApi || typeof wxApi.getSystemInfoSync !== 'function') {
    return fallback;
  }
  try {
    const info = wxApi.getSystemInfoSync();
    return {
      width: info.windowWidth || info.screenWidth || fallback.width,
      height: info.windowHeight || info.screenHeight || fallback.height
    };
  } catch (error) {
    return fallback;
  }
}

function getDevicePixelRatio(wxApi) {
  if (!wxApi || typeof wxApi.getSystemInfoSync !== 'function') {
    return 1;
  }
  try {
    return wxApi.getSystemInfoSync().pixelRatio || 1;
  } catch (error) {
    return 1;
  }
}

function drawBackground(ctx, width, height, time, theme) {
  const stops = theme && Array.isArray(theme.background) ? theme.background : ['#111827', '#172554', '#0f172a'];
  const gradient = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, 0, height) : null;
  if (gradient && gradient.addColorStop) {
    gradient.addColorStop(0, stops[0] || '#111827');
    gradient.addColorStop(0.52, stops[1] || stops[0] || '#172554');
    gradient.addColorStop(1, stops[2] || stops[1] || '#0f172a');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = stops[0] || '#111827';
  }
  ctx.fillRect(0, 0, width, height);

  const t = (time || 0) * 0.001;

  ctx.save();
  ctx.globalAlpha = 0.16;
  const halo = ctx.createRadialGradient ? ctx.createRadialGradient(width * 0.5, height * 0.22, 8, width * 0.5, height * 0.22, Math.max(width, height) * 0.7) : null;
  if (halo && halo.addColorStop) {
    halo.addColorStop(0, 'rgba(141,215,255,0.22)');
    halo.addColorStop(0.55, 'rgba(141,215,255,0.08)');
    halo.addColorStop(1, 'rgba(141,215,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#67e8f9';
  for (let i = 0; i < 3; i += 1) {
    const x = width * (0.18 + i * 0.31) + Math.sin(t * 0.6 + i) * 18;
    const y = height * (0.24 + i * 0.19) + Math.cos(t * 0.4 + i) * 12;
    const radius = Math.max(width, height) * (0.14 + i * 0.03);
    const glow = ctx.createRadialGradient ? ctx.createRadialGradient(x, y, 10, x, y, radius) : null;
    if (glow && glow.addColorStop) {
      glow.addColorStop(0, 'rgba(103,232,249,0.14)');
      glow.addColorStop(0.7, 'rgba(103,232,249,0.05)');
      glow.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  const spacing = 48;
  for (let row = -1; row < Math.ceil(height / spacing) + 1; row += 1) {
    const y = row * spacing + Math.sin(t * 0.7 + row) * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 83 + Math.sin(t + i) * 16) % width;
    const y = (i * 47 + Math.cos(t * 0.7 + i) * 10) % height;
    ctx.beginPath();
    ctx.arc(x, y, 1.1 + (i % 3) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function createMockCanvas() {
  const listeners = {};
  return {
    width: 375,
    height: 667,
    style: {},
    getContext: function getContext() { return createMockContext(); },
    addEventListener: function addEventListener(name, fn) {
      listeners[name] = fn;
    },
    removeEventListener: function removeEventListener(name) {
      delete listeners[name];
    },
    __listeners: listeners
  };
}

function createMockContext() {
  const ctx = {};
  ctx.globalAlpha = 1;
  const methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo',
    'bezierCurveTo', 'arc', 'rect', 'fill', 'stroke', 'clearRect', 'fillRect', 'strokeRect',
    'translate', 'scale', 'rotate', 'setTransform', 'fillText', 'strokeText', 'measureText',
    'clip', 'createLinearGradient', 'createRadialGradient', 'setLineDash'
  ];
  for (let i = 0; i < methods.length; i += 1) {
    ctx[methods[i]] = function noop() {
      if (methods[i] === 'measureText') {
        return { width: 0 };
      }
      if (methods[i] === 'createLinearGradient' || methods[i] === 'createRadialGradient') {
        return { addColorStop: function addColorStop() {} };
      }
      return undefined;
    };
  }
  return ctx;
}

function requestFrame(fn) {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(fn);
  }
  return setTimeout(() => fn(now()), 16);
}

function cancelFrame(id) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(id);
  } else if (typeof clearTimeout === 'function') {
    clearTimeout(id);
  }
}

function now() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

let gameInstance = null;

function bootstrap(options) {
  if (!BoardRenderer || !TileAnimator || !EffectRenderer || !CausalPathRenderer || !TouchHandler) {
    throw new Error('Render/input modules are not available.');
  }
  gameInstance = new CausalChainGame(options || {});
  if (!options || options.autoStart !== false) {
    gameInstance.start();
  }
  return gameInstance;
}

const shouldAutoBootstrap = typeof wx !== 'undefined' ||
  (BoardRenderer && TileAnimator && EffectRenderer && CausalPathRenderer && TouchHandler &&
    typeof document !== 'undefined' && typeof process === 'undefined');

if (shouldAutoBootstrap) {
  bootstrap();
}

const exported = {
  CausalChainGame,
  bootstrap,
  createMockCanvas,
  createMockContext,
  FallbackCausalEngine,
  FallbackBoardGenerator
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
} else if (typeof globalThis !== 'undefined') {
  globalThis.CausalChainGame = exported;
}
