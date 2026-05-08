const DEFAULT_COLORS = {
  mask: 'rgba(4, 8, 16, 0.68)',
  panel: 'rgba(247, 250, 255, 0.97)',
  text: '#14213D',
  muted: '#5C677D',
  primary: '#118AB2',
  secondary: '#E9EEF8',
  star: '#FFD166',
  danger: '#EF476F'
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
    roundRect(ctx, button.x, button.y, button.width, button.height, 15);
    ctx.fillStyle = primary ? this.colors.primary : this.colors.secondary;
    ctx.fill();
    ctx.fillStyle = primary ? '#FFFFFF' : this.colors.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.t(`result.buttons.${button.action}`), button.x + button.width / 2, button.y + button.height / 2);
  }

  drawStars(ctx, x, y, stars) {
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < stars ? this.colors.star : this.colors.secondary;
      ctx.fillText('*', x + i * 36, y);
    }
  }

  draw(ctx) {
    if (!this.visible || !ctx) return;
    const panelWidth = Math.min(this.width - 34, 336);
    const panelHeight = this.mode === 'win' ? 360 : 384;
    const panelX = (this.width - panelWidth) / 2;
    const panelY = Math.max(74, (this.height - panelHeight) / 2);

    ctx.save();
    ctx.fillStyle = this.colors.mask;
    ctx.fillRect(0, 0, this.width, this.height);

    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
    ctx.fillStyle = this.colors.panel;
    ctx.fill();

    ctx.fillStyle = this.mode === 'win' ? this.colors.primary : this.colors.danger;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t(`result.${this.mode}.title`), this.width / 2, panelY + 24);

    if (this.mode === 'win') {
      this.drawStars(ctx, this.width / 2 - 36, panelY + 78, this.result.stars || 0);
    } else {
      ctx.fillStyle = this.colors.muted;
      ctx.font = '14px sans-serif';
      ctx.fillText(this.t(`result.fail.reason.${this.result.reason}`), this.width / 2, panelY + 82);
    }

    const statY = panelY + 128;
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

    const actions = this.mode === 'win'
      ? ['share', 'retry', 'next']
      : ['undo', 'restart', 'adRevive'];
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
    this.buttons.forEach((button, index) => this.drawButton(ctx, button, index === 0 || button.action === 'next'));

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
