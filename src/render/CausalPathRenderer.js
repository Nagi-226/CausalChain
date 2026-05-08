class CausalPathRenderer {
  constructor(options) {
    const opts = options || {};
    this.layout = opts.layout || null;
    this.paths = [];
    this.activePath = null;
    this.visibleUntil = 0;
    this.palette = opts.palette || ['#38bdf8', '#22c55e', '#f59e0b', '#fb7185', '#a78bfa'];
  }

  setLayout(layout) {
    this.layout = layout;
  }

  setPath(path, options) {
    const opts = options || {};
    this.activePath = path && path.nodes ? path : this.exportPathData(path, null, {
      source: 'setPath',
      createdAt: Date.now()
    });
    this.visibleUntil = defaultNow() + (opts.duration || 3000);
  }

  clear() {
    this.activePath = null;
    this.visibleUntil = 0;
  }

  recordMove(result, boardRenderer) {
    if (!result) {
      return null;
    }
    const path = [];
    if (result.causeTile) {
      path.push(result.causeTile);
    }
    if (result.effectTile) {
      path.push(result.effectTile);
    }
    const layers = result.backtrackLayers || result.rippleLayers || [];
    for (let i = 0; i < layers.length; i += 1) {
      const layer = Array.isArray(layers[i]) ? layers[i] : [layers[i]];
      for (let j = 0; j < layer.length; j += 1) {
        path.push(layer[j]);
      }
    }
    const data = this.exportPathData(path, boardRenderer, {
      move: result,
      createdAt: Date.now()
    });
    this.paths.push(data);
    this.activePath = data;
    this.visibleUntil = defaultNow() + 3000;
    return data;
  }

  draw(ctx, boardRenderer) {
    const data = this.activePath;
    if (!data || defaultNow() > this.visibleUntil) {
      return;
    }
    this.drawPathData(ctx, data, {
      alpha: Math.max(0, Math.min(1, (this.visibleUntil - defaultNow()) / 700)),
      boardRenderer
    });
  }

  drawPathData(ctx, data, options) {
    if (!ctx || !data) {
      return;
    }
    const opts = options || {};
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    ctx.save();
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < edges.length; i += 1) {
      const edge = edges[i];
      const a = nodes[edge.from];
      const b = nodes[edge.to];
      if (!a || !b) {
        continue;
      }
      ctx.strokeStyle = edge.color || this.palette[i % this.palette.length];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - 12;
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      drawArrowHead(ctx, a, b, edge.color || this.palette[i % this.palette.length]);
    }
    for (let n = 0; n < nodes.length; n += 1) {
      const node = nodes[n];
      ctx.fillStyle = node.color || '#f8fafc';
      ctx.strokeStyle = 'rgba(15,23,42,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n + 1), node.x, node.y + 0.5);
    }
    ctx.restore();
  }

  exportPathData(path, boardRenderer, metadata) {
    const normalized = this.normalizePath(path);
    const nodes = [];
    for (let i = 0; i < normalized.length; i += 1) {
      const tile = normalized[i];
      const center = getTileCenter(tile, boardRenderer, this.layout);
      nodes.push({
        id: tile.id || (tile.row + ':' + tile.col),
        row: tile.row,
        col: tile.col,
        type: tile.type || tile.role,
        color: resolveNodeColor(tile, i, this.palette),
        x: center.x,
        y: center.y
      });
    }
    const edges = [];
    for (let e = 0; e < nodes.length - 1; e += 1) {
      edges.push({
        from: e,
        to: e + 1,
        color: this.palette[e % this.palette.length],
        relation: e === 0 ? 'direct' : 'backtrack'
      });
    }
    return {
      version: '0.0.5-path-data',
      metadata: metadata || {},
      bounds: boardRenderer && typeof boardRenderer.getBoardRect === 'function'
        ? boardRenderer.getBoardRect()
        : layoutToBounds(this.layout),
      nodes,
      edges
    };
  }

  normalizePath(path) {
    if (!path) {
      return [];
    }
    if (path.nodes && Array.isArray(path.nodes)) {
      return path.nodes;
    }
    if (Array.isArray(path)) {
      return path.filter(Boolean);
    }
    return [path];
  }

  getHistory() {
    return this.paths.slice();
  }
}

function getTileCenter(tile, boardRenderer, layout) {
  if (tile.x !== undefined && tile.y !== undefined) {
    return { x: tile.x, y: tile.y };
  }
  if (boardRenderer && typeof boardRenderer.getTileCenter === 'function') {
    return boardRenderer.getTileCenter(tile);
  }
  const l = layout || { x: 0, y: 0, cell: 48, gap: 5 };
  return {
    x: l.x + tile.col * (l.cell + l.gap) + l.cell / 2,
    y: l.y + tile.row * (l.cell + l.gap) + l.cell / 2
  };
}

function resolveNodeColor(tile, index, palette) {
  if (tile && tile.color && tile.color[0] === '#') {
    return tile.color;
  }
  return palette[index % palette.length];
}

function layoutToBounds(layout) {
  const l = layout || { x: 0, y: 0, width: 0, height: 0 };
  return { x: l.x, y: l.y, width: l.width, height: l.height };
}

function drawArrowHead(ctx, a, b, color) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 8;
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.55);
  ctx.lineTo(-size, size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function defaultNow() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

module.exports = CausalPathRenderer;
