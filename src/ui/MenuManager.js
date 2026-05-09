const DEFAULT_COLORS = {
  bgTop: '#09111F',
  bgBottom: '#16263F',
  card: 'rgba(255, 255, 255, 0.10)',
  card2: 'rgba(255, 255, 255, 0.17)',
  text: '#F6F8FF',
  muted: '#A8B3CF',
  accent: '#8DD7FF',
  gold: '#FFD166',
  locked: 'rgba(255, 255, 255, 0.05)',
  success: 'rgba(45, 212, 191, 0.18)',
  successBorder: 'rgba(45, 212, 191, 0.28)'
};

function readString(strings, key) {
  return key.split('.').reduce((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return node[part];
  }, strings) || key;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const MEMORY_STORAGE = {};

class MenuManager {
  constructor(options = {}) {
    this.strings = options.strings || {};
    this.levels = options.levels || [];
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.width = options.width || 375;
    this.height = options.height || 667;
    this.screen = options.screen || 'main';
    this.visible = options.visible !== false;
    this.buttons = [];
    this.levelButtons = [];
    this.leaderboardState = options.leaderboardState || { rows: [] };
    this.settings = { sound: true, lowMotion: false, colorblind: false, ...(options.settings || {}) };
    this.progressKey = options.progressKey || 'ccgs.progress.v0';
    this.progress = options.progress || this.loadProgress();
  }

  setStrings(strings) {
    this.strings = strings || {};
  }

  setLevels(levels) {
    this.levels = levels || [];
  }

  setLayout(width, height) {
    this.width = width;
    this.height = height;
  }

  t(key) {
    return readString(this.strings, key);
  }

  show(screen = this.screen) {
    this.visible = true;
    this.screen = screen;
  }

  hide() {
    this.visible = false;
  }

  update(options = {}) {
    if (options.progress) this.progress = { ...this.progress, ...options.progress };
    if (options.settings) this.settings = { ...this.settings, ...options.settings };
    if (options.leaderboardState) this.leaderboardState = { ...this.leaderboardState, ...options.leaderboardState };
  }

  getStorage() {
    if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) {
      return {
        get: (key) => wx.getStorageSync(key),
        set: (key, value) => wx.setStorageSync(key, value)
      };
    }
    return {
      get: (key) => MEMORY_STORAGE[key],
      set: (key, value) => { MEMORY_STORAGE[key] = value; }
    };
  }

  loadProgress() {
    const saved = this.getStorage().get(this.progressKey);
    return saved || { unlockedLevel: 1, stars: {}, bestMoves: {}, bestTimeMs: {} };
  }

  saveProgress() {
    this.getStorage().set(this.progressKey, this.progress);
    return this.progress;
  }

  setLevelResult(levelId, result) {
    const previousStars = this.progress.stars[levelId] || 0;
    this.progress.stars[levelId] = Math.max(previousStars, result.stars || 0);
    if (!this.progress.bestMoves[levelId] || result.moves < this.progress.bestMoves[levelId]) {
      this.progress.bestMoves[levelId] = result.moves;
    }
    if (!this.progress.bestTimeMs[levelId] || result.elapsedMs < this.progress.bestTimeMs[levelId]) {
      this.progress.bestTimeMs[levelId] = result.elapsedMs;
    }
    this.progress.unlockedLevel = Math.max(this.progress.unlockedLevel, Number(levelId) + 1);
    return this.saveProgress();
  }

  drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, this.colors.bgTop);
    gradient.addColorStop(1, this.colors.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.globalAlpha = 0.12;
    const halo = ctx.createRadialGradient ? ctx.createRadialGradient(this.width * 0.5, this.height * 0.18, 8, this.width * 0.5, this.height * 0.18, Math.max(this.width, this.height) * 0.7) : null;
    if (halo && halo.addColorStop) {
      halo.addColorStop(0, 'rgba(196,181,253,0.22)');
      halo.addColorStop(0.58, 'rgba(125,211,252,0.08)');
      halo.addColorStop(1, 'rgba(141,215,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 97) % this.width;
      const y = (i * 151) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  createButton(action, labelKey, x, y, width, height, primary = false) {
    return { action, labelKey, x, y, width, height, primary };
  }

  drawButton(ctx, button) {
    ctx.save();
    ctx.shadowColor = button.primary ? 'rgba(141,215,255,0.20)' : 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = button.primary ? 14 : 8;
    roundRect(ctx, button.x, button.y, button.width, button.height, 17);
    ctx.fillStyle = button.primary ? this.colors.accent : this.colors.card2;
    ctx.fill();
    ctx.strokeStyle = button.primary ? 'rgba(141,215,255,0.30)' : 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = button.primary ? '#09111F' : this.colors.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.t(button.labelKey), button.x + button.width / 2, button.y + button.height / 2);
  }

  drawTitle(ctx, subtitleKey) {
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.title'), this.width / 2, 82);
    ctx.fillStyle = this.colors.muted;
    ctx.font = '14px sans-serif';
    ctx.fillText(this.t(subtitleKey), this.width / 2, 124);
  }

  drawMain(ctx) {
    this.drawTitle(ctx, 'menu.subtitle');
    const w = Math.min(280, this.width - 56);
    const x = (this.width - w) / 2;
    const cardY = 170;
    const cardH = Math.min(470, this.height - cardY - 22);
    roundRect(ctx, x, cardY, w, cardH, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dailyDone = Boolean(this.progress.dailyChallenge && this.progress.dailyChallenge.claimed);
    const dailyStateText = dailyDone ? 'menu.dailyChallengeRewardClaimed' : 'menu.dailyChallengeRewardReady';
    const dailyStateColor = dailyDone ? this.colors.gold : this.colors.accent;
    const dailyY = cardY + 18;
    const leaderboardY = dailyY + 88;
    const buttonY = leaderboardY + 60;

    ctx.save();
    roundRect(ctx, x + 18, dailyY, w - 36, 78, 18);
    ctx.fillStyle = dailyDone ? this.colors.success : 'rgba(141,215,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = dailyDone ? this.colors.successBorder : 'rgba(141,215,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = dailyStateColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.dailyChallenge'), x + 32, dailyY + 12);
    ctx.fillStyle = this.colors.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(this.t(dailyStateText), x + 32, dailyY + 34);
    ctx.fillStyle = this.colors.muted;
    ctx.fillText(this.t('menu.dailyChallengeHint'), x + 32, dailyY + 55);
    ctx.restore();

    ctx.save();
    roundRect(ctx, x + 18, leaderboardY, w - 36, 44, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = this.colors.gold;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.leaderboard'), x + 32, leaderboardY + 8);
    ctx.fillStyle = this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.fillText(this.t('menu.leaderboardSubtitle'), x + 32, leaderboardY + 26);
    ctx.restore();

    this.buttons = [
      this.createButton('start', 'menu.start', x + 18, buttonY, w - 36, 48, true),
      this.createButton('levelSelect', 'menu.levelSelect', x + 18, buttonY + 58, w - 36, 48),
      this.createButton('dailyChallenge', 'menu.dailyChallenge', x + 18, buttonY + 116, w - 36, 48),
      this.createButton('leaderboard', 'menu.leaderboard', x + 18, buttonY + 174, w - 36, 48),
      this.createButton('settings', 'menu.settings', x + 18, buttonY + 232, w - 36, 48)
    ];
    this.buttons.forEach((button) => this.drawButton(ctx, button));
  }

  drawLeaderboard(ctx) {
    this.drawTitle(ctx, 'menu.leaderboardSubtitle');
    this.buttons = [this.createButton('back', 'menu.back', 18, 34, 76, 36)];
    this.buttons.forEach((button) => this.drawButton(ctx, button));

    const rows = (this.leaderboardState && this.leaderboardState.rows) || [];
    const cardX = 24;
    const cardW = this.width - 48;
    const usesOpenDataContext = this.leaderboardState && this.leaderboardState.usesOpenDataContext;
    roundRect(ctx, cardX, 160, cardW, Math.min(470, this.height - 190), 20);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.dailyChallenge'), cardX + 16, 172);

    if (usesOpenDataContext) {
      ctx.fillStyle = this.colors.card2;
      roundRect(ctx, cardX + 16, 206, cardW - 32, 84, 16);
      ctx.fill();
      ctx.fillStyle = this.colors.muted;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.t('menu.leaderboardLoading'), this.width / 2, 248);
      return;
    }
    if (!rows.length) {
      ctx.fillStyle = this.colors.card2;
      roundRect(ctx, cardX + 16, 206, cardW - 32, 84, 16);
      ctx.fill();
      ctx.fillStyle = this.colors.muted;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.t('menu.leaderboardEmpty'), this.width / 2, 248);
      return;
    }

    rows.slice(0, 8).forEach((row, index) => {
      const y = 206 + index * 48;
      roundRect(ctx, cardX + 16, y, cardW - 32, 38, 14);
      ctx.fillStyle = index === 0 ? this.colors.card2 : this.colors.card;
      ctx.fill();
      ctx.fillStyle = this.colors.gold;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${row.rank || index + 1}`, cardX + 32, y + 19);
      ctx.fillStyle = this.colors.text;
      ctx.fillText(row.nickname || 'Player', cardX + 80, y + 19);
      ctx.textAlign = 'right';
      ctx.fillText(`${row.bestMoves || '-'} ${this.t('hud.moves')}`, cardX + cardW - 32, y + 19);
    });
  }

  drawPaused(ctx) {
    this.drawTitle(ctx, 'menu.paused');
    const w = Math.min(270, this.width - 70);
    const x = (this.width - w) / 2;
    this.buttons = [
      this.createButton('resume', 'menu.resume', x, 220, w, 48, true),
      this.createButton('restart', 'menu.restart', x, 280, w, 48),
      this.createButton('main', 'menu.main', x, 340, w, 48)
    ];
    this.buttons.forEach((button) => this.drawButton(ctx, button));
  }

  drawSettings(ctx) {
    this.drawTitle(ctx, 'menu.settings');
    const w = Math.min(290, this.width - 50);
    const x = (this.width - w) / 2;
    roundRect(ctx, x - 6, 184, w + 12, 290, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.settingsHint') || 'Tune the starry journey to your preference.', x + 12, 198);

    this.buttons = [
      this.createButton('toggleSound', this.settings.sound ? 'settings.soundOn' : 'settings.soundOff', x, 226, w, 48),
      this.createButton('toggleMotion', this.settings.lowMotion ? 'settings.motionLow' : 'settings.motionFull', x, 286, w, 48),
      this.createButton('toggleColorblind', this.settings.colorblind ? 'settings.colorblindOn' : 'settings.colorblindOff', x, 346, w, 48),
      this.createButton('back', 'menu.back', x, 410, w, 44, true)
    ];
    this.buttons.forEach((button) => this.drawButton(ctx, button));
  }

  drawLevelSelect(ctx) {
    this.drawTitle(ctx, 'menu.levelSelect');
    this.buttons = [this.createButton('back', 'menu.back', 18, 34, 76, 36)];
    this.buttons.forEach((button) => this.drawButton(ctx, button));
    const columns = 5;
    const size = Math.min(54, Math.floor((this.width - 44) / columns) - 8);
    const startX = (this.width - columns * size - (columns - 1) * 8) / 2;
    const startY = 176;
    const panelW = this.width - 36;
    roundRect(ctx, 18, 152, panelW, Math.max(300, Math.ceil(this.levels.slice(0, 20).length / columns) * (size + 12) + 52), 20);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t('menu.levelSelectHint') || 'Choose a level for the starry journey.', 34, 166);
    this.levelButtons = [];
    this.levels.slice(0, 20).forEach((level, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * (size + 8);
      const y = startY + row * (size + 12);
      const locked = level.id > this.progress.unlockedLevel;
      const stars = this.progress.stars[level.id] || 0;
      this.levelButtons.push({ levelId: level.id, x, y, width: size, height: size, locked });
      roundRect(ctx, x, y, size, size, 14);
      ctx.fillStyle = locked ? this.colors.locked : this.colors.card2;
      ctx.fill();
      ctx.fillStyle = locked ? this.colors.muted : this.colors.text;
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(level.id), x + size / 2, y + size / 2 - 5);
      ctx.fillStyle = this.colors.gold;
      ctx.font = '11px sans-serif';
      ctx.fillText('*'.repeat(stars), x + size / 2, y + size - 13);
    });
  }

  draw(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save();
    this.drawBackground(ctx);
    this.levelButtons = [];
    if (this.screen === 'levelSelect') this.drawLevelSelect(ctx);
    else if (this.screen === 'paused') this.drawPaused(ctx);
    else if (this.screen === 'settings') this.drawSettings(ctx);
    else if (this.screen === 'leaderboard') this.drawLeaderboard(ctx);
    else this.drawMain(ctx);
    ctx.restore();
  }

  handleTap(x, y) {
    if (!this.visible) return null;
    const levelButton = this.levelButtons.find((b) => (
      x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    ));
    if (levelButton) {
      return {
        type: 'menu.level',
        levelId: levelButton.levelId,
        locked: levelButton.locked
      };
    }

    const button = this.buttons.find((b) => (
      x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    ));
    if (!button) return null;

    if (button.action === 'levelSelect') this.screen = 'levelSelect';
    if (button.action === 'dailyChallenge') this.screen = 'main';
    if (button.action === 'leaderboard') this.screen = 'leaderboard';
    if (button.action === 'settings') this.screen = 'settings';
    if (button.action === 'main') this.screen = 'main';
    if (button.action === 'back') this.screen = 'main';
    if (button.action === 'toggleSound') this.settings.sound = !this.settings.sound;
    if (button.action === 'toggleMotion') this.settings.lowMotion = !this.settings.lowMotion;
    if (button.action === 'toggleColorblind') this.settings.colorblind = !this.settings.colorblind;

    return { type: 'menu.action', action: button.action, screen: this.screen, settings: { ...this.settings } };
  }
}

module.exports = MenuManager;
