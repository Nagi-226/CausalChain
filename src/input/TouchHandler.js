class TouchHandler {
  constructor(canvas, boardRenderer, engine, animator, effects, options) {
    const opts = options || {};
    this.canvas = canvas;
    this.boardRenderer = boardRenderer;
    this.engine = engine;
    this.animator = animator;
    this.effects = effects;
    this.onMoveResult = opts.onMoveResult || function noop() {};
    this.onDragChange = opts.onDragChange || function noop() {};
    this.onTap = opts.onTap || function noop() {};
    this.shouldSkipBacktrackAnimation = opts.shouldSkipBacktrackAnimation || function noSkip() { return false; };
    this.active = false;
    this.drag = null;
    this.target = null;
    this.tapCandidate = null;
    this.boundStart = (event) => this.handleStart(event);
    this.boundMove = (event) => this.handleMove(event);
    this.boundEnd = (event) => this.handleEnd(event);
    this.boundCancel = (event) => this.handleCancel(event);
    this.attached = false;
  }

  attach() {
    if (this.attached || !this.canvas) {
      return;
    }
    this.attached = true;
    if (typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('touchstart', this.boundStart);
      this.canvas.addEventListener('touchmove', this.boundMove);
      this.canvas.addEventListener('touchend', this.boundEnd);
      this.canvas.addEventListener('touchcancel', this.boundCancel);
      return;
    }
    if (typeof wx !== 'undefined') {
      this.wxBindings = [];
      this.bindWx('onTouchStart', this.boundStart);
      this.bindWx('onTouchMove', this.boundMove);
      this.bindWx('onTouchEnd', this.boundEnd);
      this.bindWx('onTouchCancel', this.boundCancel);
    }
  }

  detach() {
    if (!this.attached || !this.canvas) {
      return;
    }
    this.attached = false;
    if (typeof this.canvas.removeEventListener === 'function') {
      this.canvas.removeEventListener('touchstart', this.boundStart);
      this.canvas.removeEventListener('touchmove', this.boundMove);
      this.canvas.removeEventListener('touchend', this.boundEnd);
      this.canvas.removeEventListener('touchcancel', this.boundCancel);
    }
    if (typeof wx !== 'undefined') {
      this.unbindWx('offTouchStart', this.boundStart);
      this.unbindWx('offTouchMove', this.boundMove);
      this.unbindWx('offTouchEnd', this.boundEnd);
      this.unbindWx('offTouchCancel', this.boundCancel);
    }
  }

  bindWx(name, fn) {
    if (typeof wx !== 'undefined' && typeof wx[name] === 'function') {
      wx[name](fn);
    }
  }

  unbindWx(name, fn) {
    if (typeof wx !== 'undefined' && typeof wx[name] === 'function') {
      wx[name](fn);
    }
  }

  handleStart(event) {
    const point = getEventPoint(event);
    if (!point) {
      return;
    }
    const hit = this.boardRenderer.hitTest(point.x, point.y);
    if (!hit || !isCauseTile(hit.tile)) {
      this.tapCandidate = point;
      return;
    }
    this.tapCandidate = null;
    this.active = true;
    this.target = null;
    this.drag = {
      tile: hit.tile,
      origin: { row: hit.row, col: hit.col },
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      target: null
    };
    if (this.animator && typeof this.animator.startDrag === 'function') {
      this.animator.startDrag(hit.tile, point);
    }
    this.emitDrag();
    preventDefault(event);
  }

  handleMove(event) {
    if (!this.active || !this.drag) {
      return;
    }
    const point = getEventPoint(event);
    if (!point) {
      return;
    }
    this.drag.x = point.x;
    this.drag.y = point.y;
    if (this.animator && typeof this.animator.updateDrag === 'function') {
      this.animator.updateDrag(point);
    }
    const target = this.findTarget(point);
    this.target = target;
    this.drag.target = target;
    this.emitDrag();
    preventDefault(event);
  }

  handleEnd(event) {
    if (!this.active || !this.drag) {
      const point = getEventPoint(event, true) || this.tapCandidate;
      if (point) this.onTap(point);
      this.tapCandidate = null;
      preventDefault(event);
      return;
    }
    const point = getEventPoint(event, true) || { x: this.drag.x, y: this.drag.y };
    const target = this.target || this.findTarget(point);
    const cause = this.drag.tile;
    if (this.animator && typeof this.animator.endDrag === 'function') {
      this.animator.endDrag();
    }
    this.active = false;
    this.drag.target = target;
    this.emitDrag(null);

    if (target && this.isAdjacent(cause, target) && isEffectTile(target)) {
      const result = this.attemptMove(cause, target);
      this.handleResult(result, cause, target);
    } else {
      this.rejectMove(cause, target);
    }
    this.drag = null;
    this.target = null;
    preventDefault(event);
  }

  handleCancel(event) {
    if (!this.drag) {
      return;
    }
    const cause = this.drag.tile;
    if (this.animator && typeof this.animator.endDrag === 'function') {
      this.animator.endDrag();
    }
    this.rejectMove(cause, this.target);
    this.active = false;
    this.drag = null;
    this.target = null;
    this.emitDrag(null);
    preventDefault(event);
  }

  findTarget(point) {
    const hit = this.boardRenderer.hitTest(point.x, point.y);
    if (!hit || !hit.tile) {
      return null;
    }
    if (!this.isAdjacent(this.drag.tile, hit.tile) || !isEffectTile(hit.tile)) {
      return null;
    }
    return hit.tile;
  }

  isAdjacent(a, b) {
    if (!a || !b) {
      return false;
    }
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  attemptMove(cause, effect) {
    if (!this.engine) {
      return { success: false, valid: false, causeTile: cause, effectTile: effect };
    }
    const input = {
      from: { row: cause.row, col: cause.col },
      to: { row: effect.row, col: effect.col },
      causeTile: cause,
      effectTile: effect
    };
    const method = this.engine.attemptMove || this.engine.processMove || this.engine.eliminate;
    if (typeof method !== 'function') {
      return { success: false, valid: false, causeTile: cause, effectTile: effect };
    }
    try {
      if (this.engine.processMove || this.engine.eliminate) {
        return normalizeResult(method.call(this.engine, input.from, input.to), cause, effect);
      }
      return normalizeResult(method.call(this.engine, input), cause, effect);
    } catch (firstError) {
      try {
        return normalizeResult(method.call(this.engine, cause, effect), cause, effect);
      } catch (secondError) {
        try {
          return normalizeResult(method.call(this.engine, input.from, input.to), cause, effect);
        } catch (thirdError) {
          return { success: false, valid: false, causeTile: cause, effectTile: effect, error: thirdError };
        }
      }
    }
  }

  handleResult(result, cause, effect) {
    if (result && result.success) {
      const eliminated = result.eliminated || result.removedTiles || [cause, effect];
      const center = midpoint(this.boardRenderer.getTileCenter(cause), this.boardRenderer.getTileCenter(effect));
      if (this.animator && typeof this.animator.playEliminate === 'function') {
        this.animator.playEliminate(eliminated, center);
      }
      if (!this.shouldSkipBacktrackAnimation() && this.animator && typeof this.animator.playBacktrackWave === 'function') {
        this.animator.playBacktrackWave(result.backtrackLayers || result.rippleLayers || [], center);
      }
      if (this.effects) {
        if (typeof this.effects.burstParticles === 'function') {
          this.effects.burstParticles(center.x, center.y, resolveEffectColor(effect), 22);
        }
        if (typeof this.effects.addRipple === 'function') {
          this.effects.addRipple(center.x, center.y, resolveEffectColor(effect), { radius: 110 });
        }
      }
      this.onMoveResult(result);
    } else {
      this.rejectMove(cause, effect);
      this.onMoveResult(result);
    }
  }

  rejectMove(cause, target) {
    if (this.animator && typeof this.animator.playInvalid === 'function') {
      this.animator.playInvalid(cause, target);
      this.animator.playBounce(cause, { x: 0, y: 0 }, { x: 0, y: 0 });
    }
    if (this.boardRenderer) {
      if (target && typeof this.boardRenderer.flashInvalid === 'function') {
        this.boardRenderer.flashInvalid({ row: target.row, col: target.col });
      }
      if (cause && typeof this.boardRenderer.flashInvalid === 'function') {
        this.boardRenderer.flashInvalid({ row: cause.row, col: cause.col });
      }
    }
  }

  emitDrag(value) {
    const payload = value === undefined ? this.drag : value;
    if (this.boardRenderer && typeof this.boardRenderer.setDragState === 'function') {
      this.boardRenderer.setDragState(payload);
    }
    this.onDragChange(payload);
  }
}

function getEventPoint(event, changed) {
  if (!event) {
    return null;
  }
  const source = changed && event.changedTouches && event.changedTouches.length
    ? event.changedTouches[0]
    : event.touches && event.touches.length
      ? event.touches[0]
      : event.changedTouches && event.changedTouches.length
        ? event.changedTouches[0]
        : event;
  if (source.clientX !== undefined && source.clientY !== undefined) {
    return { x: source.clientX, y: source.clientY };
  }
  if (source.x !== undefined && source.y !== undefined) {
    return { x: source.x, y: source.y };
  }
  return null;
}

function preventDefault(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
}

function isCauseTile(tile) {
  return tile && (tile.type === 'cause' || tile.role === 'cause' || tile.isCause === true);
}

function isEffectTile(tile) {
  return tile && (tile.type === 'effect' || tile.role === 'effect' || tile.isEffect === true);
}

function normalizeResult(value, cause, effect) {
  if (value === true) {
    return { success: true, valid: true, causeTile: cause, effectTile: effect, eliminated: [cause, effect] };
  }
  if (!value) {
    return { success: false, valid: false, causeTile: cause, effectTile: effect };
  }
  value.success = value.success !== undefined ? value.success : value.valid === true;
  value.valid = value.valid !== undefined ? value.valid : value.success === true;
  value.causeTile = value.causeTile || cause;
  value.effectTile = value.effectTile || effect;
  if (!value.eliminated && !value.removedTiles && value.move && value.move.removed) {
    value.removedTiles = value.move.removed.map((entry) => {
      const tile = entry.tile || entry;
      tile.row = entry.row !== undefined ? entry.row : tile.row;
      tile.col = entry.col !== undefined ? entry.col : tile.col;
      return tile;
    });
  }
  if (!value.backtrackLayers && value.move && value.move.rewindLayers) {
    value.backtrackLayers = value.move.rewindLayers.map((layer) => {
      if (!Array.isArray(layer)) {
        return layer;
      }
      return layer.map((entry) => {
        const tile = entry.tile || entry;
        tile.row = entry.row !== undefined ? entry.row : tile.row;
        tile.col = entry.col !== undefined ? entry.col : tile.col;
        return tile;
      });
    });
  }
  if (value.completed === undefined) {
    value.completed = value.status === 'won' || (value.snapshot && value.snapshot.status === 'won');
  }
  return value;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function resolveEffectColor(tile) {
  const colors = {
    red: '#ef4444',
    crimson: '#ef4444',
    blue: '#38bdf8',
    azure: '#38bdf8',
    green: '#22c55e',
    gold: '#f59e0b',
    amber: '#f59e0b',
    violet: '#a78bfa'
  };
  if (tile && tile.color && tile.color[0] === '#') {
    return tile.color;
  }
  return colors[tile && tile.color] || '#f8fafc';
}

module.exports = TouchHandler;
