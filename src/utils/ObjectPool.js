class ObjectPool {
  constructor(factory, reset = null, options = {}) {
    if (typeof factory !== 'function') {
      throw new TypeError('ObjectPool requires a factory function');
    }
    this.factory = factory;
    this.reset = typeof reset === 'function' ? reset : null;
    this.maxSize = options.maxSize || Infinity;
    this._free = [];
    this._active = new Set();
    this.created = 0;

    if (options.initialSize) {
      this.warm(options.initialSize);
    }
  }

  warm(count) {
    const amount = Math.max(0, count | 0);
    for (let i = 0; i < amount && this._free.length < this.maxSize; i += 1) {
      this._free.push(this._create());
    }
    return this;
  }

  acquire(...args) {
    const item = this._free.pop() || this._create();
    this._active.add(item);
    if (this.reset) this.reset(item, 'acquire', ...args);
    return item;
  }

  release(item) {
    if (!this._active.has(item)) return false;
    this._active.delete(item);
    if (this.reset) this.reset(item, 'release');
    if (this._free.length < this.maxSize) {
      this._free.push(item);
    }
    return true;
  }

  releaseAll() {
    for (const item of Array.from(this._active)) {
      this.release(item);
    }
  }

  clear() {
    this._free.length = 0;
    this._active.clear();
  }

  stats() {
    return {
      created: this.created,
      free: this._free.length,
      active: this._active.size,
      maxSize: this.maxSize
    };
  }

  _create() {
    this.created += 1;
    return this.factory();
  }
}

module.exports = ObjectPool;
