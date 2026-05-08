const ITEM_IDS = ['freeze', 'reveal', 'undo', 'shuffle'];

const ITEM_ICON = {
  freeze: 'F',
  reveal: 'R',
  undo: 'U',
  shuffle: 'S'
};

const DEFAULT_COLORS = {
  bg: 'rgba(8, 16, 32, 0.9)',
  slot: 'rgba(255, 255, 255, 0.12)',
  selected: '#8DD7FF',
  text: '#F6F8FF',
  muted: '#A8B3CF',
  locked: 'rgba(255, 255, 255, 0.06)',
  ad: '#FFD166'
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
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

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

      roundRect(ctx, x, slotY, slotWidth, slotHeight, 15);
      ctx.fillStyle = disabled ? this.colors.locked : this.colors.slot;
      ctx.fill();
      if (isSelected) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.colors.selected;
        ctx.stroke();
      }

      ctx.fillStyle = disabled ? this.colors.muted : this.colors.text;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ITEM_ICON[itemId], x + slotWidth / 2, slotY + 19);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = this.colors.muted;
      ctx.fillText(this.t(`items.${itemId}.name`), x + slotWidth / 2, slotY + 39);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = requiresAd ? this.colors.ad : this.colors.text;
      const hint = requiresAd ? this.t('toolbar.ad') : `x${count}`;
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
