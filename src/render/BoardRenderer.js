class BoardRenderer {
  constructor(ctx, options) {
    const opts = options || {};
    this.ctx = ctx;
    this.cols = opts.cols || 8;
    this.rows = opts.rows || 6;
    this.width = opts.width || 375;
    this.height = opts.height || 667;
    this.dpr = opts.dpr || 1;
    this.board = null;
    this.animator = opts.animator || null;
    this.effectRenderer = opts.effectRenderer || null;
    this.pathRenderer = opts.pathRenderer || null;
    this.dragState = null;
    this.highlightTarget = null;
    this.invalidCells = [];
    this.selectedCell = null;
    this.layout = this.computeLayout();
    this.palette = {
      red: '#ef4444',
      crimson: '#ef4444',
      blue: '#38bdf8',
      azure: '#38bdf8',
      green: '#22c55e',
      gold: '#f59e0b',
      amber: '#f59e0b',
      violet: '#a78bfa',
      rose: '#fb7185',
      slate: '#334155'
    };
    this.theme = {
      panel: 'rgba(15,23,42,0.58)',
      grid: 'rgba(2,6,23,0.34)'
    };
  }

  setTheme(theme) {
    if (!theme) return;
    this.theme = Object.assign({}, this.theme, theme);
    if (theme.palette) {
      this.palette = Object.assign({}, this.palette, theme.palette);
    }
  }

  setCanvasSize(width, height, dpr) {
    this.width = width || this.width;
    this.height = height || this.height;
    this.dpr = dpr || this.dpr;
    this.layout = this.computeLayout();
    if (this.pathRenderer && typeof this.pathRenderer.setLayout === 'function') {
      this.pathRenderer.setLayout(this.layout);
    }
    return this.layout;
  }

  setBoard(board) {
    this.board = board || this.board;
  }

  setAnimator(animator) {
    this.animator = animator;
  }

  setEffectRenderer(effectRenderer) {
    this.effectRenderer = effectRenderer;
  }

  setPathRenderer(pathRenderer) {
    this.pathRenderer = pathRenderer;
    if (pathRenderer && typeof pathRenderer.setLayout === 'function') {
      pathRenderer.setLayout(this.layout);
    }
  }

  setDragState(dragState) {
    this.dragState = dragState || null;
    this.selectedCell = dragState && dragState.tile ? { row: dragState.tile.row, col: dragState.tile.col } : null;
    this.highlightTarget = dragState && dragState.target ? { row: dragState.target.row, col: dragState.target.col } : null;
  }

  setHighlightTarget(target) {
    this.highlightTarget = target || null;
  }

  flashInvalid(cell, duration) {
    this.invalidCells.push({
      row: cell.row,
      col: cell.col,
      start: getNow(),
      duration: duration || 260
    });
  }

  computeLayout() {
    const safeWidth = clamp(this.width, 320, 480);
    const sideMargin = Math.max(14, Math.floor(safeWidth * 0.04));
    const usableWidth = this.width - sideMargin * 2;
    const topReserved = Math.max(84, Math.floor(this.height * 0.13));
    const bottomReserved = Math.max(118, Math.floor(this.height * 0.18));
    const usableHeight = this.height - topReserved - bottomReserved;
    const gap = clamp(Math.floor(usableWidth * 0.012), 4, 7);
    const cell = Math.floor(Math.min(
      (usableWidth - gap * (this.cols - 1)) / this.cols,
      (usableHeight - gap * (this.rows - 1)) / this.rows
    ));
    const boardWidth = cell * this.cols + gap * (this.cols - 1);
    const boardHeight = cell * this.rows + gap * (this.rows - 1);
    return {
      x: Math.round((this.width - boardWidth) / 2),
      y: Math.round(topReserved + Math.max(0, (usableHeight - boardHeight) / 2)),
      width: boardWidth,
      height: boardHeight,
      cell,
      gap,
      cols: this.cols,
      rows: this.rows,
      radius: clamp(Math.floor(cell * 0.18), 8, 14)
    };
  }

  getBoardRect() {
    return {
      x: this.layout.x,
      y: this.layout.y,
      width: this.layout.width,
      height: this.layout.height
    };
  }

  getCellRect(row, col) {
    const l = this.layout;
    return {
      x: l.x + col * (l.cell + l.gap),
      y: l.y + row * (l.cell + l.gap),
      width: l.cell,
      height: l.cell,
      cx: l.x + col * (l.cell + l.gap) + l.cell / 2,
      cy: l.y + row * (l.cell + l.gap) + l.cell / 2
    };
  }

  screenToGrid(x, y) {
    const l = this.layout;
    const col = Math.floor((x - l.x) / (l.cell + l.gap));
    const row = Math.floor((y - l.y) / (l.cell + l.gap));
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return null;
    }
    const rect = this.getCellRect(row, col);
    if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) {
      return null;
    }
    return { row, col };
  }

  hitTest(x, y) {
    const cell = this.screenToGrid(x, y);
    if (!cell) {
      return null;
    }
    const tile = this.getTileAt(cell.row, cell.col);
    return tile ? { row: cell.row, col: cell.col, tile } : null;
  }

  getTileAtPoint(x, y) {
    const hit = this.hitTest(x, y);
    return hit ? hit.tile : null;
  }

  getTileAt(row, col) {
    const tiles = flattenTiles(this.board);
    for (let i = 0; i < tiles.length; i += 1) {
      const tile = normalizeTile(tiles[i], i);
      if (!tile.removed && tile.row === row && tile.col === col) {
        return tile;
      }
    }
    return null;
  }

  getTileCenter(tile) {
    const rect = this.getCellRect(tile.row, tile.col);
    return { x: rect.cx, y: rect.cy };
  }

  draw(options) {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const opts = options || {};
    this.pruneInvalidCells(opts.time || getNow());

    ctx.save();
    this.drawPanel(ctx);
    this.drawGrid(ctx);
    this.drawTiles(ctx, opts);
    this.drawBacktrackWaves(ctx, opts);
    if (this.pathRenderer && typeof this.pathRenderer.draw === 'function') {
      this.pathRenderer.draw(ctx, this);
    }
    if (this.effectRenderer && typeof this.effectRenderer.draw === 'function') {
      this.effectRenderer.draw(ctx, this.layout);
    }
    ctx.restore();
  }

  drawPanel(ctx) {
    const l = this.layout;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 9;
    roundedRect(ctx, l.x - 10, l.y - 10, l.width + 20, l.height + 20, 24);
    ctx.fillStyle = this.theme.panel || 'rgba(15,23,42,0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,232,240,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawGrid(ctx) {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const rect = this.getCellRect(row, col);
        const invalid = this.getInvalidFlash(row, col);
        const selected = this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col;
        const target = this.highlightTarget && this.highlightTarget.row === row && this.highlightTarget.col === col;
        ctx.save();
        roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.layout.radius);
        ctx.fillStyle = invalid ? 'rgba(239,68,68,0.32)' : (this.theme.grid || 'rgba(2,6,23,0.34)');
        ctx.fill();
        ctx.strokeStyle = target ? '#fef3c7' : (selected ? '#93c5fd' : 'rgba(148,163,184,0.18)');
        ctx.lineWidth = target || selected ? 3 : 1;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawTiles(ctx, options) {
    const tiles = flattenTiles(this.board);
    for (let i = 0; i < tiles.length; i += 1) {
      const tile = normalizeTile(tiles[i], i);
      if (tile.removed || this.isDraggingTile(tile)) {
        continue;
      }
      this.drawTile(ctx, tile, options);
    }
    if (this.dragState && this.dragState.tile) {
      this.drawTile(ctx, normalizeTile(this.dragState.tile, 0), options, this.dragState);
    }
  }

  drawBacktrackWaves(ctx, options) {
    if (!this.animator || typeof this.animator.getActiveWaves !== 'function') {
      return;
    }
    const waves = this.animator.getActiveWaves(options && options.time);
    for (let i = 0; i < waves.length; i += 1) {
      const wave = waves[i];
      const tiles = wave.tiles || [];
      ctx.save();
      ctx.globalAlpha = 0.62 * (1 - wave.progress);
      ctx.strokeStyle = tiles.some((tile) => tile.relation === 'chain') ? (this.theme.ripple || '#67e8f9') : '#bfdbfe';
      ctx.lineWidth = 3;
      for (let t = 0; t < tiles.length; t += 1) {
        const tile = tiles[t];
        const row = tile.row;
        const col = tile.col;
        if (row === undefined || col === undefined) continue;
        const rect = this.getCellRect(row, col);
        ctx.beginPath();
        ctx.arc(rect.cx, rect.cy, this.layout.cell * (0.26 + wave.progress * 0.44), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTile(ctx, tile, options, dragOverride) {
    const rect = this.getCellRect(tile.row, tile.col);
    const transform = this.animator && typeof this.animator.getTileTransform === 'function'
      ? this.animator.getTileTransform(tile)
      : {};
    const drag = dragOverride || null;
    const scale = drag ? 1.08 : (transform.scale || 1);
    const alpha = transform.alpha === undefined ? 1 : transform.alpha;
    const lift = drag ? -4 : (transform.lift || 0);
    const dx = drag ? drag.x - rect.cx : (transform.x || 0);
    const dy = drag ? drag.y - rect.cy + lift : (transform.y || lift);
    const color = this.resolveColor(tile);
    const invalid = this.getInvalidFlash(tile.row, tile.col);
    const glow = transform.glow || (this.highlightTarget && this.highlightTarget.row === tile.row && this.highlightTarget.col === tile.col ? 0.8 : 0);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(rect.cx + dx, rect.cy + dy);
    ctx.scale(scale, scale);
    if (drag || glow > 0) {
      ctx.shadowColor = invalid ? '#ef4444' : color;
      ctx.shadowBlur = drag ? 20 : 14 * glow;
      ctx.shadowOffsetY = drag ? 8 : 0;
    }
    this.drawTileBody(ctx, rect.width, color, tile, invalid);
    this.drawTileIcon(ctx, rect.width, tile);
    this.drawCauseEffectArrow(ctx, rect.width, tile);
    this.drawChainBadge(ctx, rect.width, tile);
    ctx.restore();
  }

  drawTileBody(ctx, size, color, tile, invalid) {
    const half = size / 2;
    const r = this.layout.radius;
    const gradient = ctx.createLinearGradient ? ctx.createLinearGradient(-half, -half, half, half) : null;
    if (gradient && gradient.addColorStop) {
      gradient.addColorStop(0, lighten(color, 0.2));
      gradient.addColorStop(1, darken(color, 0.2));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color;
    }
    roundedRect(ctx, -half, -half, size, size, r);
    ctx.fill();
    ctx.strokeStyle = invalid ? '#fecaca' : 'rgba(255,255,255,0.42)';
    ctx.lineWidth = invalid ? 4 : 1.5;
    ctx.stroke();

    ctx.globalAlpha *= 0.16;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, -half + 5, -half + 5, size - 10, Math.max(8, size * 0.22), r * 0.7);
    ctx.fill();
    ctx.globalAlpha /= 0.16;
  }

  drawTileIcon(ctx, size, tile) {
    const icon = tile.icon || tile.kind || 'spark';
    const radius = size * 0.18;
    ctx.save();
    ctx.translate(0, size * 0.04);
    ctx.fillStyle = 'rgba(15,23,42,0.58)';
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = 2;
    if (icon === 'moon' || icon === 1 || icon === '1') {
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI * 0.2, Math.PI * 1.8);
      ctx.arc(radius * 0.45, -radius * 0.08, radius * 0.9, Math.PI * 1.78, Math.PI * 0.22, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (icon === 'seed' || icon === 2 || icon === '2') {
      ctx.beginPath();
      ctx.moveTo(0, -radius * 1.2);
      ctx.lineTo(radius * 1.1, radius);
      ctx.lineTo(-radius * 1.1, radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const outer = i % 2 === 0 ? radius * 1.25 : radius * 0.55;
        const x = Math.cos(angle) * outer;
        const y = Math.sin(angle) * outer;
        if (i === 0) {
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCauseEffectArrow(ctx, size, tile) {
    const isCause = tile.type === 'cause' || tile.role === 'cause' || tile.isCause;
    const startX = isCause ? -size * 0.34 : size * 0.22;
    const endX = isCause ? -size * 0.16 : size * 0.04;
    const y = -size * 0.32;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
    const dir = isCause ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(endX, y);
    ctx.lineTo(endX - dir * 6, y - 4);
    ctx.lineTo(endX - dir * 6, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.font = Math.max(9, Math.floor(size * 0.18)) + 'px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(isCause ? 'C' : 'E', size * 0.38, -size * 0.42);
    ctx.restore();
  }

  drawChainBadge(ctx, size, tile) {
    const count = tile.chainCount || tile.links || 0;
    if (!count) {
      return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    ctx.beginPath();
    ctx.arc(size * 0.32, size * 0.32, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = Math.max(8, Math.floor(size * 0.15)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), size * 0.32, size * 0.32);
    ctx.restore();
  }

  resolveColor(tile) {
    const key = tile.color || tile.colorId || tile.element || 'slate';
    if (this.palette[key]) {
      return this.palette[key];
    }
    const keys = Object.keys(this.palette);
    const index = Math.abs(hashString(String(key))) % keys.length;
    return this.palette[keys[index]];
  }

  isDraggingTile(tile) {
    if (!this.dragState || !this.dragState.tile) {
      return false;
    }
    const dragged = this.dragState.tile;
    return dragged.id === tile.id || (dragged.row === tile.row && dragged.col === tile.col);
  }

  getInvalidFlash(row, col) {
    const time = getNow();
    for (let i = 0; i < this.invalidCells.length; i += 1) {
      const item = this.invalidCells[i];
      if (item.row === row && item.col === col && time - item.start < item.duration) {
        return item;
      }
    }
    return null;
  }

  pruneInvalidCells(time) {
    const kept = [];
    for (let i = 0; i < this.invalidCells.length; i += 1) {
      if (time - this.invalidCells[i].start < this.invalidCells[i].duration) {
        kept.push(this.invalidCells[i]);
      }
    }
    this.invalidCells = kept;
  }
}

function flattenTiles(board) {
  if (!board) {
    return [];
  }
  if (Array.isArray(board.tiles)) {
    return board.tiles;
  }
  if (Array.isArray(board)) {
    const result = [];
    for (let row = 0; row < board.length; row += 1) {
      const line = board[row];
      if (Array.isArray(line)) {
        for (let col = 0; col < line.length; col += 1) {
          if (line[col]) {
            const tile = line[col];
            if (tile.row === undefined) {
              tile.row = row;
            }
            if (tile.col === undefined) {
              tile.col = col;
            }
            result.push(tile);
          }
        }
      }
    }
    return result;
  }
  return [];
}

function normalizeTile(tile, index) {
  if (!tile.id) {
    tile.id = 'tile-' + index + '-' + tile.row + '-' + tile.col;
  }
  if (!tile.type) {
    tile.type = tile.role || (tile.isCause ? 'cause' : 'effect');
  }
  return tile;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius || 0, width / 2, height / 2);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function lighten(hex, amount) {
  return adjustHex(hex, amount);
}

function darken(hex, amount) {
  return adjustHex(hex, -amount);
}

function adjustHex(hex, amount) {
  if (!hex || hex[0] !== '#') {
    return hex;
  }
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  r = Math.max(0, Math.min(255, Math.round(r + 255 * amount)));
  g = Math.max(0, Math.min(255, Math.round(g + 255 * amount)));
  b = Math.max(0, Math.min(255, Math.round(b + 255 * amount)));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function getNow() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

module.exports = BoardRenderer;
