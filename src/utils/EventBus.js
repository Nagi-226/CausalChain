class EventBus {
  constructor() {
    this._events = new Map();
  }

  on(eventName, handler, context = null) {
    if (typeof handler !== 'function') {
      throw new TypeError('EventBus.on requires a function handler');
    }
    const listeners = this._events.get(eventName) || [];
    const entry = { handler, context, once: false };
    listeners.push(entry);
    this._events.set(eventName, listeners);
    return () => this.off(eventName, handler, context);
  }

  once(eventName, handler, context = null) {
    if (typeof handler !== 'function') {
      throw new TypeError('EventBus.once requires a function handler');
    }
    const listeners = this._events.get(eventName) || [];
    const entry = { handler, context, once: true };
    listeners.push(entry);
    this._events.set(eventName, listeners);
    return () => this.off(eventName, handler, context);
  }

  off(eventName, handler = null, context = null) {
    if (!this._events.has(eventName)) return false;
    if (!handler) {
      this._events.delete(eventName);
      return true;
    }

    const next = this._events
      .get(eventName)
      .filter((listener) => listener.handler !== handler || listener.context !== context);

    if (next.length === 0) {
      this._events.delete(eventName);
    } else {
      this._events.set(eventName, next);
    }
    return true;
  }

  emit(eventName, payload = undefined) {
    const direct = this._events.get(eventName) || [];
    const wildcard = this._events.get('*') || [];
    const listeners = direct.concat(wildcard);
    if (listeners.length === 0) return 0;

    let called = 0;
    for (const listener of listeners.slice()) {
      listener.handler.call(listener.context, payload, eventName);
      called += 1;
      if (listener.once) {
        this.off(eventName, listener.handler, listener.context);
        if (eventName !== '*') {
          this.off('*', listener.handler, listener.context);
        }
      }
    }
    return called;
  }

  clear(eventName = null) {
    if (eventName) {
      this._events.delete(eventName);
    } else {
      this._events.clear();
    }
  }

  listenerCount(eventName) {
    return (this._events.get(eventName) || []).length;
  }
}

module.exports = EventBus;
