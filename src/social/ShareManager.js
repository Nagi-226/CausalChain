const CARD_WIDTH = 600;
const CARD_HEIGHT = 800;

const DEFAULT_COLORS = {
  bgTop: '#07111F',
  bgBottom: '#12324D',
  panel: 'rgba(255,255,255,0.10)',
  line: '#8DD7FF',
  text: '#F7FAFF',
  muted: '#A9B7D0',
  gold: '#FFD166',
  danger: '#EF476F'
};

class ShareManager {
  constructor(options = {}) {
    this.wx = options.wxApi || (typeof wx !== 'undefined' ? wx : null);
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.cardWidth = options.cardWidth || CARD_WIDTH;
    this.cardHeight = options.cardHeight || CARD_HEIGHT;
    this.appTitle = options.appTitle || 'Causal Chain';
    this.queryPrefix = options.queryPrefix || 'source=share';
    this.lastShare = null;
  }

  buildSharePayload(result = {}, pathData = {}, options = {}) {
    const levelId = Number(result.levelId || 1);
    const moves = Number(result.moves || 0);
    const minimumSteps = Number(result.minimumSteps || 0);
    const stars = Number(result.stars || 0);
    const rank = result.rankingPercent || options.rankingPercent || null;
    const trigger = options.trigger || result.shareTrigger || 'clear';
    const title = options.title || this.buildTitle(levelId, moves, minimumSteps, stars, rank, trigger);
    const query = [
      this.queryPrefix,
      `level=${encodeURIComponent(levelId)}`,
      `moves=${encodeURIComponent(moves)}`,
      `stars=${encodeURIComponent(stars)}`,
      `trigger=${encodeURIComponent(trigger)}`
    ].filter(Boolean).join('&');

    return {
      title,
      query,
      imageUrl: options.imageUrl || result.imageUrl || '',
      data: {
        levelId,
        moves,
        minimumSteps,
        stars,
        rankingPercent: rank,
        trigger,
        pathNodeCount: pathData && pathData.nodes ? pathData.nodes.length : 0
      }
    };
  }

  buildTitle(levelId, moves, minimumSteps, stars, rankingPercent, trigger = 'clear') {
    if (trigger === 'share_revive') {
      return `第${levelId}关时间线陷入死局，帮我重启因果！`;
    }
    if (trigger === 'new_record') {
      return `第${levelId}关刷新纪录：${moves}步闭合因果链`;
    }
    if (trigger === 'friend_record') {
      return `第${levelId}关超越好友纪录：${moves}步闭合因果链`;
    }
    if (trigger === 'first_ten_clear') {
      return `前10关首通达成：第${levelId}关因果链已闭合`;
    }
    const starText = stars > 0 ? `${stars}星` : '通关';
    const target = minimumSteps > 0 ? ` / 最优${minimumSteps}步` : '';
    const rank = rankingPercent ? `，超过${rankingPercent}%玩家` : '';
    return `第${levelId}关${starText}：${moves}步闭合因果链${target}${rank}`;
  }

  async shareResult(result = {}, pathData = {}, options = {}) {
    const card = await this.generatePathCard(result, pathData, options);
    const payload = this.buildSharePayload(result, pathData, { ...options, imageUrl: card.tempFilePath || options.imageUrl });
    this.lastShare = { payload, card, result: { ...result }, pathData };

    if (this.wx && typeof this.wx.shareAppMessage === 'function') {
      this.wx.shareAppMessage(payload);
    }

    return { success: true, payload, card };
  }

  async showShareImage(result = {}, pathData = {}, options = {}) {
    const card = await this.generatePathCard(result, pathData, options);
    if (!this.wx || typeof this.wx.showShareImageMenu !== 'function' || !card.tempFilePath) {
      return { success: false, reason: 'share_image_unavailable', card };
    }
    await callWx(this.wx.showShareImageMenu, this.wx, { path: card.tempFilePath });
    return { success: true, card };
  }

  async generatePathCard(result = {}, pathData = {}, options = {}) {
    const canvas = this.createCanvas(this.cardWidth, this.cardHeight);
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : createMockContext();
    this.drawCard(ctx, result, pathData || {}, options);
    const tempFilePath = await this.canvasToTempFilePath(canvas).catch(() => '');
    return {
      canvas,
      tempFilePath,
      width: this.cardWidth,
      height: this.cardHeight,
      pathNodeCount: pathData && pathData.nodes ? pathData.nodes.length : 0
    };
  }

  drawCard(ctx, result = {}, pathData = {}, options = {}) {
    if (!ctx) return;
    const w = this.cardWidth;
    const h = this.cardHeight;
    const colors = this.colors;

    ctx.save();
    const bg = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, 0, h) : null;
    if (bg && bg.addColorStop) {
      bg.addColorStop(0, colors.bgTop);
      bg.addColorStop(1, colors.bgBottom);
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = colors.bgTop;
    }
    ctx.fillRect(0, 0, w, h);

    this.drawStarscape(ctx, w, h);
    roundRect(ctx, 36, 44, w - 72, 118, 28);
    ctx.fillStyle = colors.panel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(141,215,255,0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.appTitle, 64, 66);
    ctx.fillStyle = colors.muted;
    ctx.font = '22px sans-serif';
    ctx.fillText(`Level ${result.levelId || 1} · ${result.moves || 0} moves`, 64, 112);

    this.drawPath(ctx, pathData, { x: 64, y: 210, width: w - 128, height: 360 });
    this.drawStats(ctx, result, 64, 612, w - 128);

    ctx.fillStyle = colors.muted;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.footer || 'Drag causes, close the loop.', w / 2, h - 58);
    ctx.restore();
  }

  drawStarscape(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    for (let i = 0; i < 44; i += 1) {
      const x = (i * 137) % width;
      const y = (i * 89) % height;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPath(ctx, pathData, rect) {
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 28);
    ctx.fillStyle = 'rgba(2,6,23,0.30)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const nodes = Array.isArray(pathData.nodes) ? pathData.nodes : [];
    if (nodes.length === 0) {
      ctx.fillStyle = this.colors.muted;
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Causal path captured after clearing a level', rect.x + rect.width / 2, rect.y + rect.height / 2);
      return;
    }

    const mapped = mapNodesToRect(nodes, rect);
    for (let i = 0; i < mapped.length - 1; i += 1) {
      const a = mapped[i];
      const b = mapped[i + 1];
      ctx.strokeStyle = edgeColor(i);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 28, b.x, b.y);
      ctx.stroke();
      drawArrowHead(ctx, a, b, edgeColor(i));
    }

    for (let n = 0; n < mapped.length; n += 1) {
      const node = mapped[n];
      ctx.fillStyle = node.color || edgeColor(n);
      ctx.beginPath();
      ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#07111F';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n + 1), node.x, node.y + 1);
    }
  }

  drawStats(ctx, result, x, y, width) {
    const stats = [
      ['Stars', '*'.repeat(Math.max(1, Number(result.stars || 0)))],
      ['Best', `${result.minimumSteps || '-'} steps`],
      ['Rewinds', String(result.backtracks || 0)]
    ];
    const gap = 14;
    const cardW = (width - gap * 2) / 3;
    for (let i = 0; i < stats.length; i += 1) {
      const sx = x + i * (cardW + gap);
      roundRect(ctx, sx, y, cardW, 96, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.11)';
      ctx.fill();
      ctx.fillStyle = this.colors.muted;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stats[i][0], sx + cardW / 2, y + 22);
      ctx.fillStyle = stats[i][0] === 'Stars' ? this.colors.gold : this.colors.text;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(stats[i][1], sx + cardW / 2, y + 56);
    }
  }

  createCanvas(width, height) {
    let canvas = null;
    if (this.wx && typeof this.wx.createOffscreenCanvas === 'function') {
      canvas = this.wx.createOffscreenCanvas({ type: '2d', width, height });
    } else if (this.wx && typeof this.wx.createCanvas === 'function') {
      canvas = this.wx.createCanvas();
    } else if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
    } else {
      canvas = createMockCanvas();
    }
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  async canvasToTempFilePath(canvas) {
    if (!this.wx || typeof this.wx.canvasToTempFilePath !== 'function') {
      return '';
    }
    const result = await callWx(this.wx.canvasToTempFilePath, this.wx, {
      canvas,
      x: 0,
      y: 0,
      width: this.cardWidth,
      height: this.cardHeight,
      destWidth: this.cardWidth,
      destHeight: this.cardHeight
    });
    return result.tempFilePath || '';
  }
}

function mapNodesToRect(nodes, rect) {
  const xs = nodes.map((node) => Number(node.x !== undefined ? node.x : node.col || 0));
  const ys = nodes.map((node) => Number(node.y !== undefined ? node.y : node.row || 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 46;
  return nodes.map((node, index) => {
    const rawX = Number(node.x !== undefined ? node.x : node.col || index);
    const rawY = Number(node.y !== undefined ? node.y : node.row || 0);
    return {
      ...node,
      x: rect.x + pad + ((rawX - minX) / spanX) * (rect.width - pad * 2),
      y: rect.y + pad + ((rawY - minY) / spanY) * (rect.height - pad * 2)
    };
  });
}

function edgeColor(index) {
  return ['#8DD7FF', '#22C55E', '#FFD166', '#FB7185', '#A78BFA'][index % 5];
}

function drawArrowHead(ctx, a, b, color) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -9);
  ctx.lineTo(-16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

function callWx(fn, context, payload) {
  return new Promise((resolve, reject) => {
    fn.call(context, {
      ...payload,
      success: resolve,
      fail: reject
    });
  });
}

function createMockCanvas() {
  return {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    getContext: () => createMockContext()
  };
}

function createMockContext() {
  const ctx = { globalAlpha: 1 };
  const methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo',
    'arc', 'fill', 'stroke', 'fillRect', 'translate', 'rotate', 'fillText'
  ];
  methods.forEach((method) => { ctx[method] = function noop() {}; });
  ctx.createLinearGradient = function createLinearGradient() {
    return { addColorStop: function addColorStop() {} };
  };
  return ctx;
}

module.exports = ShareManager;
