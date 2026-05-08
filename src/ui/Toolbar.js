const ITEM_IDS = ['freeze', 'reveal', 'undo', 'shuffle'];

const ITEM_ICON = {
  freeze: '❄',
  reveal: '🔍',
  undo: '↩',
  shuffle: '🎲'
};

const DEFAULT_COLORS = {
  bg: 'rgba(8, 16, 32, 0.88)',
  slot: 'rgba(255, 255, 255, 0.10)',
  selected: '#8DD7FF',
  text: '#F7FAFF',
  muted: '#A9B7D0',
  locked: 'rgba(255, 255, 255, 0.05)',
  ad: '#FFD166',
  border: 'rgba(141, 215, 255, 0.16)',
  adBg: 'rgba(255, 209, 102, 0.12)',
  adBorder: 'rgba(255, 209, 102, 0.30)'
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

class Toolbar {
  constructor(options = {}) {
    this.strings = options.strings || {};
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.width = options.width || 375;
    this.height = options.height || 667;
    this.safeBottom = options.safeBottom || 0;
    this.barHeight = 92;
    this.items = options.items || ITEM_IDS;
    this.hitBoxes = [];
    this.state = {
      enabled: true,
      selectedItem: null,
      inventory: { freeze: 0, reveal: 0, undo: 0, shuffle: 0 },
      perLevelUsed: { freeze: 0, reveal: 0, undo: 0, shuffle: 0 },
      limits: { freeze: 1, reveal: 1, undo: 2, shuffle: 1 },
      adHints: { freeze: true, reveal: true, undo: true, shuffle: true },
      cooldowns: { freeze: 0, reveal: 0, undo: 0, shuffle: 0 }
    };
  }

  setStrings(strings) {
    this.strings = strings || {};
  }

  setLayout(width, height, safeBottom = this.safeBottom) {
    this.width = width;
    this.height = height;
    this.safeBottom = safeBottom;
    this.barHeight = Math.max(86, 92 + safeBottom);
  }

  update(nextState = {}) {
    this.state = {
      ...this.state,
      ...nextState,
      inventory: { ...this.state.inventory, ...(nextState.inventory || {}) },
      perLevelUsed: { ...this.state.perLevelUsed, ...(nextState.perLevelUsed || {}) },
      limits: { ...this.state.limits, ...(nextState.limits || {}) },
      adHints: { ...this.state.adHints, ...(nextState.adHints || {}) },
      cooldowns: { ...this.state.cooldowns, ...(nextState.cooldowns || {}) }
    };
  }

  t(key) {
    return readString(this.strings, key);
  }

  getBounds() {
    return { x: 0, y: this.height - this.barHeight, width: this.width, height: this.barHeight };
  }

  getItemAt(x, y) {
    return this.hitBoxes.find((box) => (
      x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
    )) || null;
  }

  draw(ctx) {
    if (!ctx) return;
    const bounds = this.getBounds();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = -2;
    roundRect(ctx, bounds.x + 8, bounds.y + 6, bounds.width - 16, bounds.height - 10, 22);
    ctx.fillStyle = this.colors.bg;
    ctx.fill();
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const gap = 8;
    const slotWidth = Math.floor((this.width - 24 - gap * (this.items.length - 1)) / this.items.length);
    const slotHeight = 66;
    const slotY = bounds.y + 12;
    this.hitBoxes = [];

    this.items.forEach((itemId, index) => {
      const x = 12 + index * (slotWidth + gap);
      const count = this.state.inventory[itemId] || 0;
      const used = this.state.perLevelUsed[itemId] || 0;
      const limit = this.state.limits[itemId] || 0;
      const limitReached = limit > 0 && used >= limit;
      const hasAd = Boolean(this.state.adHints[itemId]);
      const disabled = !this.state.enabled || limitReached || this.state.cooldowns[itemId] > 0;
      const requiresAd = count <= 0 && hasAd;
      const isSelected = this.state.selectedItem === itemId;

      const box = { x, y: slotY, width: slotWidth, height: slotHeight, itemId, disabled, requiresAd };
      this.hitBoxes.push(box);

      ctx.save();
      ctx.shadowColor = isSelected ? 'rgba(141,215,255,0.26)' : 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = isSelected ? 12 : 6;
      roundRect(ctx, x, slotY, slotWidth, slotHeight, 15);
      const isAdReady = requiresAd && !disabled;
      ctx.fillStyle = disabled ? this.colors.locked : (isAdReady ? this.colors.adBg : this.colors.slot);
      ctx.fill();
      ctx.strokeStyle = isSelected ? this.colors.selected : (isAdReady ? this.colors.adBorder : this.colors.border);
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      if (!disabled) {
        ctx.fillStyle = isAdReady ? 'rgba(255,209,102,0.10)' : 'rgba(255,255,255,0.06)';
        roundRect(ctx, x + 2, slotY + 2, slotWidth - 4, 18, 10);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = disabled ? this.colors.muted : (isAdReady ? this.colors.ad : this.colors.text);
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ITEM_ICON[itemId], x + slotWidth / 2, slotY + 18);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = this.colors.muted;
      ctx.fillText(this.t(`items.${itemId}.name`), x + slotWidth / 2, slotY + 39);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = isAdReady ? this.colors.ad : this.colors.text;
      const hint = isAdReady ? this.t('toolbar.ad') : `x${count}`;
      ctx.fillText(limitReached ? this.t('toolbar.limit') : hint, x + slotWidth / 2, slotY + 56);
    });

    ctx.restore();
  }

  handleTap(x, y) {
    const box = this.getItemAt(x, y);
    if (!box) return null;
    return {
      type: 'toolbar.itemTap',
      itemId: box.itemId,
      disabled: box.disabled,
      requiresAd: box.requiresAd
    };
  }
}

module.exports = Toolbar;
