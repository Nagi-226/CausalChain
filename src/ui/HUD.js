const DEFAULT_COLORS = {
  bg: 'rgba(8, 16, 32, 0.86)',
  card: 'rgba(255, 255, 255, 0.11)',
  text: '#F6F8FF',
  muted: '#A8B3CF',
  accent: '#8DD7FF',
  danger: '#FF7D7D'
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

class HUD {
  constructor(options = {}) {
    this.strings = options.strings || {};
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.bounds = {
      x: 0,
      y: 0,
      width: options.width || 375,
      height: 86,
      safeTop: options.safeTop || 0
    };
    this.state = {
      levelId: 1,
      status: 'ready',
      moves: 0,
      minimumSteps: 0,
      elapsedMs: 0,
      backtracks: 0
    };
    this.pauseButton = null;
    this.visible = true;
  }

  setStrings(strings) {
    this.strings = strings || {};
  }

  setLayout(width, height, safeTop = this.bounds.safeTop) {
    this.bounds.width = width;
    this.bounds.safeTop = safeTop;
    this.bounds.height = Math.max(78, 82 + safeTop);
    return this.getBounds();
  }

  getBounds() {
    return { ...this.bounds };
  }

  update(nextState = {}) {
    this.state = { ...this.state, ...nextState };
  }

  t(key) {
    return readString(this.strings, key);
  }

  formatTime(ms = this.state.elapsedMs) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  drawStat(ctx, labelKey, value, x, y, width) {
    roundRect(ctx, x, y, width, 38, 12);
    ctx.fillStyle = this.colors.card;
    ctx.fill();
    ctx.fillStyle = this.colors.muted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t(labelKey), x + 10, y + 6);
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(String(value), x + 10, y + 20);
  }

  draw(ctx) {
    if (!this.visible || !ctx) return;

    const { width, height, safeTop } = this.bounds;
    ctx.save();
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = this.colors.accent;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.t('hud.level')} ${this.state.levelId}`, 14, safeTop + 18);

    ctx.fillStyle = this.state.status === 'fail' ? this.colors.danger : this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.fillText(this.t(`state.${this.state.status}`), 96, safeTop + 18);

    const pauseSize = 34;
    this.pauseButton = { x: width - pauseSize - 12, y: safeTop + 6, width: pauseSize, height: pauseSize };
    roundRect(ctx, this.pauseButton.x, this.pauseButton.y, pauseSize, pauseSize, 11);
    ctx.fillStyle = this.colors.card;
    ctx.fill();
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('II', this.pauseButton.x + pauseSize / 2, this.pauseButton.y + 18);

    const gap = 6;
    const statY = safeTop + 42;
    const statWidth = Math.floor((width - 28 - gap * 3) / 4);
    this.drawStat(ctx, 'hud.moves', this.state.moves, 14, statY, statWidth);
    this.drawStat(ctx, 'hud.minimum', this.state.minimumSteps, 14 + (statWidth + gap), statY, statWidth);
    this.drawStat(ctx, 'hud.time', this.formatTime(), 14 + (statWidth + gap) * 2, statY, statWidth);
    this.drawStat(ctx, 'hud.backtracks', this.state.backtracks, 14 + (statWidth + gap) * 3, statY, statWidth);

    ctx.restore();
  }

  handleTap(x, y) {
    if (!this.visible || !this.pauseButton) return null;
    const b = this.pauseButton;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return { type: 'hud.pause' };
    }
    return null;
  }
}

module.exports = HUD;
