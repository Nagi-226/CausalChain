const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const getRAF = () => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const request =
    root.requestAnimationFrame ||
    (root.wx && root.wx.requestAnimationFrame) ||
    ((callback) => setTimeout(() => callback(now()), 1000 / 60));
  const cancel =
    root.cancelAnimationFrame ||
    root.cancelRequestAnimationFrame ||
    (root.wx && root.wx.cancelAnimationFrame) ||
    ((id) => clearTimeout(id));
  return { request, cancel };
};

class Timer {
  constructor(update = null, options = {}) {
    this.update = update;
    this.targetFPS = options.fps || 60;
    this.maxDelta = options.maxDelta || 100;
    this.running = false;
    this.paused = false;
    this.elapsed = 0;
    this.frame = 0;
    this._lastTime = 0;
    this._rafId = null;
    this._tasks = [];
    this._boundTick = (time) => this._tick(time);
  }

  start(update = this.update) {
    if (update) this.update = update;
    if (typeof this.update !== 'function') {
      throw new TypeError('Timer.start requires an update callback');
    }
    if (this.running) return this;

    this.running = true;
    this.paused = false;
    this.elapsed = 0;
    this.frame = 0;
    this._lastTime = now();
    this._schedule();
    return this;
  }

  stop() {
    if (!this.running) return this;
    const { cancel } = getRAF();
    if (this._rafId !== null) cancel(this._rafId);
    this._rafId = null;
    this.running = false;
    this.paused = false;
    return this;
  }

  pause() {
    this.paused = true;
    return this;
  }

  resume() {
    if (!this.running) return this;
    this.paused = false;
    this._lastTime = now();
    return this;
  }

  setFPS(fps) {
    this.targetFPS = Math.max(1, Number(fps) || 60);
    return this;
  }

  after(delayMs, callback) {
    return this._addTask({ delay: Math.max(0, delayMs), interval: 0, callback, elapsed: 0 });
  }

  every(intervalMs, callback) {
    return this._addTask({
      delay: Math.max(0, intervalMs),
      interval: Math.max(1, intervalMs),
      callback,
      elapsed: 0
    });
  }

  _addTask(task) {
    if (typeof task.callback !== 'function') {
      throw new TypeError('Timer task requires a callback');
    }
    this._tasks.push(task);
    return () => {
      const index = this._tasks.indexOf(task);
      if (index >= 0) this._tasks.splice(index, 1);
    };
  }

  _schedule() {
    const { request } = getRAF();
    this._rafId = request(this._boundTick);
  }

  _tick(time) {
    if (!this.running) return;

    const minFrameMs = 1000 / this.targetFPS;
    const rawDelta = time - this._lastTime;
    if (rawDelta < minFrameMs - 0.5) {
      this._schedule();
      return;
    }

    this._lastTime = time;
    const delta = Math.min(Math.max(0, rawDelta), this.maxDelta);

    if (!this.paused) {
      this.elapsed += delta;
      this.frame += 1;
      this._runTasks(delta);
      this.update(delta, this.elapsed, this.frame);
    }

    this._schedule();
  }

  _runTasks(delta) {
    for (let i = this._tasks.length - 1; i >= 0; i -= 1) {
      const task = this._tasks[i];
      task.elapsed += delta;
      if (task.elapsed < task.delay) continue;

      task.callback(delta, this.elapsed);
      if (task.interval > 0) {
        task.elapsed = 0;
        task.delay = task.interval;
      } else {
        this._tasks.splice(i, 1);
      }
    }
  }
}

module.exports = Timer;
