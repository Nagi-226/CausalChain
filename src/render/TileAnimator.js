class TileAnimator {
  constructor(options) {
    const opts = options || {};
    this.clock = opts.clock || defaultNow;
    this.animations = [];
    this.drag = null;
    this.waves = [];
    this.timeline = [];
    this.reducedMotion = Boolean(opts.reducedMotion);
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    if (this.reducedMotion) {
      this.waves = [];
    }
  }

  update(time) {
    const now = time || this.clock();
    const kept = [];
    for (let i = 0; i < this.animations.length; i += 1) {
      const anim = this.animations[i];
      if (now - anim.start <= anim.duration) {
        kept.push(anim);
      }
    }
    this.animations = kept;

    const keptWaves = [];
    for (let w = 0; w < this.waves.length; w += 1) {
      const wave = this.waves[w];
      if (now - wave.start <= wave.duration + wave.delay) {
        keptWaves.push(wave);
      }
    }
    this.waves = keptWaves;
  }

  startDrag(tile, point) {
    this.drag = {
      tile,
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      start: this.clock()
    };
    return this.drag;
  }

  updateDrag(point) {
    if (!this.drag) {
      return null;
    }
    this.drag.x = point.x;
    this.drag.y = point.y;
    return this.drag;
  }

  endDrag() {
    const drag = this.drag;
    this.drag = null;
    return drag;
  }

  getDrag() {
    return this.drag;
  }

  playEliminate(tiles, origin, options) {
    const opts = options || {};
    const list = normalizeTiles(tiles);
    const start = this.clock();
    for (let i = 0; i < list.length; i += 1) {
      this.animations.push({
        type: 'eliminate',
        tileId: getTileId(list[i]),
        start,
        duration: opts.duration || (this.reducedMotion ? 220 : 400),
        origin: origin || null
      });
    }
  }

  playBounce(tile, from, to, options) {
    const opts = options || {};
    this.animations.push({
      type: 'bounce',
      tileId: getTileId(tile),
      start: this.clock(),
      duration: opts.duration || (this.reducedMotion ? 180 : 300),
      from: from || { x: 0, y: 0 },
      to: to || { x: 0, y: 0 }
    });
  }

  playInvalid(tile, target, options) {
    const opts = options || {};
    const start = this.clock();
    if (tile) {
      this.animations.push({
        type: 'invalid',
        tileId: getTileId(tile),
        start,
        duration: opts.duration || (this.reducedMotion ? 180 : 260),
        target
      });
    }
    if (target) {
      this.animations.push({
        type: 'invalid',
        tileId: getTileId(target),
        start,
        duration: opts.duration || (this.reducedMotion ? 180 : 260),
        target
      });
    }
  }

  playBacktrackWave(layers, origin, options) {
    if (this.reducedMotion || (options && options.skip)) {
      this.timeline = [];
      return [];
    }
    const timeline = this.createBacktrackTimeline(layers, options);
    const start = this.clock();
    for (let i = 0; i < timeline.length; i += 1) {
      this.waves.push({
        type: 'backtrack',
        layer: timeline[i].layer,
        tiles: timeline[i].tiles,
        origin,
        start,
        delay: timeline[i].start,
        duration: timeline[i].duration
      });
    }
    return timeline;
  }

  createBacktrackTimeline(layers, options) {
    const opts = options || {};
    const layerDelay = opts.layerDelay || 300;
    const duration = opts.duration || 300;
    const timeline = [];
    const source = layers || [];
    for (let i = 0; i < source.length; i += 1) {
      timeline.push({
        layer: i,
        start: i * layerDelay,
        end: i * layerDelay + duration,
        duration,
        tiles: normalizeTiles(source[i])
      });
    }
    this.timeline = timeline;
    return timeline;
  }

  getActiveWaves(time) {
    const now = time || this.clock();
    const active = [];
    for (let i = 0; i < this.waves.length; i += 1) {
      const wave = this.waves[i];
      const elapsed = now - wave.start - wave.delay;
      if (elapsed >= 0 && elapsed <= wave.duration) {
        active.push(Object.assign({}, wave, {
          progress: easeOutCubic(elapsed / wave.duration)
        }));
      }
    }
    return active;
  }

  getTimeline() {
    return this.timeline.slice();
  }

  getTileTransform(tile, time) {
    const now = time || this.clock();
    const tileId = getTileId(tile);
    const out = {
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1,
      glow: 0,
      lift: 0
    };

    if (this.drag && getTileId(this.drag.tile) === tileId) {
      out.scale = 1.08;
      out.lift = -4;
      out.glow = 0.65;
      return out;
    }

    for (let i = 0; i < this.animations.length; i += 1) {
      const anim = this.animations[i];
      if (anim.tileId !== tileId) {
        continue;
      }
      const progress = clamp01((now - anim.start) / anim.duration);
      if (anim.type === 'eliminate') {
        const flash = Math.sin(progress * Math.PI);
        out.scale *= 1 - easeInCubic(progress) * 0.85;
        out.alpha *= 1 - easeInCubic(progress);
        out.glow = Math.max(out.glow, flash);
      } else if (anim.type === 'bounce') {
        const p = easeOutBack(progress);
        out.x += lerp(anim.from.x || 0, anim.to.x || 0, p);
        out.y += lerp(anim.from.y || 0, anim.to.y || 0, p);
      } else if (anim.type === 'invalid') {
        out.x += Math.sin(progress * Math.PI * 8) * (1 - progress) * 6;
        out.glow = Math.max(out.glow, 0.9 * (1 - progress));
      }
    }
    return out;
  }
}

function normalizeTiles(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function getTileId(tile) {
  if (!tile) {
    return '';
  }
  return tile.id || (tile.row + ':' + tile.col);
}

function defaultNow() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInCubic(t) {
  return t * t * t;
}

function easeOutCubic(t) {
  const p = 1 - t;
  return 1 - p * p * p;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

module.exports = TileAnimator;
