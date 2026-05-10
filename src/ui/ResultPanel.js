const DEFAULT_COLORS = {
  mask: 'rgba(4, 8, 16, 0.72)',
  panel: 'rgba(247, 250, 255, 0.98)',
  text: '#14213D',
  muted: '#5C677D',
  primary: '#118AB2',
  secondary: '#E9EEF8',
  star: '#FFD166',
  danger: '#EF476F',
  border: 'rgba(17, 138, 178, 0.14)',
  borderStrong: 'rgba(17, 138, 178, 0.24)',
  winGlow: 'rgba(255, 209, 102, 0.16)',
  failGlow: 'rgba(239, 71, 111, 0.14)',
  reviveGlow: 'rgba(45, 212, 191, 0.14)',
  reviveBanner: 'rgba(45, 212, 191, 0.10)',
  adSuccessGlow: 'rgba(255, 209, 102, 0.14)',
  adFailGlow: 'rgba(239, 71, 111, 0.12)',
  starThemeGlow: 'rgba(196,181,253,0.16)',
  starThemeBanner: 'rgba(125,211,252,0.10)',
  starThemeStroke: 'rgba(196,181,253,0.22)',
  oceanThemeGlow: 'rgba(45,212,191,0.14)',
  oceanThemeBanner: 'rgba(20,184,166,0.10)',
  oceanThemeStroke: 'rgba(103,232,249,0.22)'
};

var CU = require('../utils/CanvasUtils.js');
var readString = CU.readString;
var roundRect = CU.roundedRect;

class ResultPanel {
  constructor(options = {}) {
    this.strings = options.strings || {};
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.width = options.width || 375;
    this.height = options.height || 667;
    this.visible = false;
    this.mode = 'win';
    this.result = {};
    this.buttons = [];
  }

  setStrings(strings) {
    this.strings = strings || {};
  }

  setLayout(width, height) {
    this.width = width;
    this.height = height;
  }

  t(key) {
    return readString(this.strings, key);
  }

  formatTime(ms = 0) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  calculateStars(moves, minimumSteps, mode = this.mode) {
    if (mode !== 'win') return 0;
    if (!minimumSteps || moves <= minimumSteps) return 3;
    if (moves <= minimumSteps + 3) return 2;
    return 1;
  }

  show(mode, result = {}) {
    this.visible = true;
    this.mode = mode === 'fail' ? 'fail' : 'win';
    this.result = {
      levelId: 1,
      moves: 0,
      minimumSteps: 0,
      elapsedMs: 0,
      backtracks: 0,
      reason: 'noMoves',
      ...result
    };
    this.result.themeLabel = this.result.themeLabel || this.result.themeName || '';
    this.result.themeVariant = this.result.themeVariant || this.result.theme || '';
    this.result.stars = typeof result.stars === 'number'
      ? result.stars
      : this.calculateStars(this.result.moves, this.result.minimumSteps, this.mode);
  }

  hide() {
    this.visible = false;
  }

  update(result = {}) {
    this.result = { ...this.result, ...result };
  }

  drawButton(ctx, button, primary = false) {
    ctx.save();
    ctx.shadowColor = primary ? 'rgba(17,138,178,0.20)' : 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = primary ? 10 : 6;
    roundRect(ctx, button.x, button.y, button.width, button.height, 15);
    ctx.fillStyle = primary ? this.colors.primary : this.colors.secondary;
    ctx.fill();
    ctx.strokeStyle = primary ? this.colors.borderStrong : this.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = primary ? '#FFFFFF' : this.colors.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.t(`result.buttons.${button.action}`), button.x + button.width / 2, button.y + button.height / 2);
  }

  drawStars(ctx, x, y, stars) {
    ctx.save();
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < stars ? this.colors.star : this.colors.secondary;
      ctx.fillText('\u2605', x + i * 36, y);
    }
    ctx.restore();
  }

  draw(ctx) {
    if (!this.visible || !ctx) return;
    const panelWidth = Math.min(this.width - 34, 336);
    const panelHeight = this.mode === 'win' ? 360 : 384;
    const panelX = (this.width - panelWidth) / 2;
    const panelY = Math.max(74, (this.height - panelHeight) / 2);
    const themeKey = String(this.result.themeLabel || this.result.themeName || this.result.theme || '').toLowerCase();
    const starTheme = themeKey.includes('starlight') || themeKey.includes('star');
    const oceanTheme = themeKey.includes('ocean') || themeKey.includes('sea') || themeKey.includes('ripple');
    const glowColor = starTheme
      ? (this.colors.starThemeGlow || 'rgba(216,180,254,0.14)')
      : (oceanTheme ? (this.colors.oceanThemeGlow || 'rgba(103,232,249,0.14)') : (this.mode === 'win' ? this.colors.winGlow : this.colors.failGlow));

    ctx.save();
    ctx.fillStyle = this.colors.mask;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = glowColor;
    roundRect(ctx, panelX - 8, panelY - 8, panelWidth + 16, panelHeight + 16, 30);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
    ctx.fillStyle = this.colors.panel;
    ctx.fill();
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = starTheme
      ? this.colors.starThemeBanner
      : oceanTheme
        ? this.colors.oceanThemeBanner
      : (this.mode === 'win'
        ? 'rgba(17,138,178,0.10)'
        : (this.result.canShareRevive ? this.colors.reviveBanner : 'rgba(239,71,111,0.10)'));
    roundRect(ctx, panelX + 18, panelY + 18, panelWidth - 36, 48, 16);
    ctx.fill();
    ctx.strokeStyle = starTheme
      ? this.colors.starThemeStroke
      : oceanTheme
        ? this.colors.oceanThemeStroke
      : (this.mode === 'win' ? 'rgba(17,138,178,0.18)' : 'rgba(239,71,111,0.14)');
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    if (this.mode === 'fail' && this.result.canShareRevive) {
      ctx.save();
      ctx.fillStyle = this.colors.reviveGlow;
      roundRect(ctx, panelX + 18, panelY + 72, panelWidth - 36, 24, 10);
      ctx.fill();
      ctx.fillStyle = '#0F766E';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.t('result.buttons.shareRevive'), this.width / 2, panelY + 84);
      ctx.restore();
    }

    ctx.fillStyle = this.mode === 'win'
      ? this.colors.primary
      : (this.result.canShareRevive ? '#0F766E' : this.colors.danger);
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t(`result.${this.mode}.title`), this.width / 2, panelY + 28);

    if (this.mode === 'win') {
      this.drawStars(ctx, this.width / 2 - 36, panelY + 86, this.result.stars || 0);
    } else {
      ctx.fillStyle = this.colors.muted;
      ctx.font = '14px sans-serif';
      ctx.fillText(this.t(`result.fail.reason.${this.result.reason}`), this.width / 2, panelY + 92);
    }

    if (this.result.adState) {
      ctx.save();
      const adState = this.result.adState;
      const adGlow = adState.success ? this.colors.adSuccessGlow : this.colors.adFailGlow;
      const adY = panelY + 112;
      roundRect(ctx, panelX + 24, adY, panelWidth - 48, 24, 10);
      ctx.fillStyle = adGlow;
      ctx.fill();
      ctx.fillStyle = adState.success ? '#92400E' : this.colors.danger;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const adLabel = adState.success ? this.t('result.ads.rewardGranted') : this.t('result.ads.unavailable');
      ctx.fillText(adLabel, this.width / 2, adY + 12);
      ctx.restore();
    }

    const statY = panelY + (this.result.adState ? 148 : 138);
    const stats = [
      ['result.stats.moves', `${this.result.moves}/${this.result.minimumSteps}`],
      ['result.stats.time', this.formatTime(this.result.elapsedMs)],
      ['result.stats.backtracks', this.result.backtracks]
    ];
    stats.forEach(([key, value], index) => {
      const y = statY + index * 30;
      ctx.fillStyle = this.colors.muted;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.t(key), panelX + 34, y);
      ctx.fillStyle = this.colors.text;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(value), panelX + panelWidth - 34, y);
    });

    if (this.result.dailyRank || this.result.rewardMultiplier) {
      ctx.fillStyle = this.colors.primary;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      const dailyText = this.result.dailyRank ? `${this.t('result.stats.dailyRank')} #${this.result.dailyRank}` : '';
      const rewardText = this.result.rewardMultiplier ? `${this.result.rewardMultiplier}x reward active` : '';
      ctx.fillText([dailyText, rewardText].filter(Boolean).join(' · '), this.width / 2, statY + 96);
    }

    const actions = this.mode === 'win'
      ? (this.result.doubleRewardClaimed ? ['share', 'retry', 'next'] : ['share', 'doubleReward', 'next'])
      : (this.result.canShareRevive ? ['shareRevive', 'undo', 'restart'] : ['undo', 'restart', 'adRevive']);
    const buttonWidth = panelWidth - 64;
    const buttonHeight = 42;
    const startY = panelY + panelHeight - 156;
    this.buttons = actions.map((action, index) => ({
      action,
      x: panelX + 32,
      y: startY + index * 50,
      width: buttonWidth,
      height: buttonHeight
    }));
    this.buttons.forEach((button, index) => this.drawButton(ctx, button, index === 0 || button.action === 'next' || button.action === 'doubleReward'));

    ctx.restore();
  }

  handleTap(x, y) {
    if (!this.visible) return null;
    const button = this.buttons.find((b) => (
      x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    ));
    if (!button) return null;
    return { type: 'result.action', action: button.action, mode: this.mode, result: { ...this.result } };
  }
}

module.exports = ResultPanel;
