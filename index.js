const EventEmitter = require('events');
const util = require('util');

class Builder {
  constructor(parent) {
    this._parent = parent;
  }

  emitter(object) {
    if (this._parent) {
      return this._parent.emitter(object);
    }
  }

  timeout(delay) {
    if (this._parent) {
      return this._parent.timeout(delay);
    }
  }

  new() {
    if (this._parent) {
      return this._parent.new();
    }
  }
}

class ActionableBuilder extends Builder {
  constructor(parent) {
    super(parent);
    this._action = undefined;
  }

  call(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Callback argument is not a function');
    }
    if (_action) {
      throw new Error('Event already has a listener');
    }
    this._action = { call: true, fn };
    return this;
  }
}

class ResolvableBuilder extends ActionableBuilder {
  constructor(parent) {
    super(parent);
  }

  resolve(value) {
    if (this._action) {
      throw new Error('Event already has a listener');
    }
    this._action = { resolve: true, value };
    return this;
  }

  reject(reason) {
    if (this._action) {
      throw new Error('Event already has a listener');
    }
    this._action = { reject: true, reason };
    return this;
  }
}

class EventBuilder extends ResolvableBuilder {
  constructor(name, once, parent) {
    super(parent);
    if (typeof name !== 'string') {
      throw new TypeError('Event name is not a string');
    }
    this._name = name;
    this._once = once;
  }

  on(event) {
    return this._parent.on(event);
  }

  once(event) {
    return this._parent.once(event);
  }
}

class EmitterBuilder extends Builder {
  constructor(object, parent) {
    super(parent);
    if (!(object instanceof EventEmitter)) {
      throw new TypeError('Object is not an instance of EventEmitter');
    }
    this._object = object;
    this._events = [];
  }

  on(event) {
    const b = new EventBuilder(event, false /* once */, this);
    this._events.push(b);
    return b;
  }

  once(event) {
    const b = new EventBuilder(event, true /* once */, this);
    this._events.push(b);
    return b;
  }
}

class TimeoutBuilder extends ResolvableBuilder {
  constructor(delay, parent) {
    super(parent);
    if (typeof delay !== 'number') {
      throw new TypeError('Timeout value is not a number');
    }
    this._delay = delay;
  }
}

class PromiseBuilder extends Builder {
  constructor() {
    super();
    this._emitters = [];
    this._timeouts = [];
  }

  emitter(object) {
    const b = new EmitterBuilder(object, this);
    this._emitters.push(b);
    return b;
  }

  timeout(delay) {
    const b = new TimeoutBuilder(delay, this);
    this._timeouts.push(b);
    return b;
  }

  new() {
    let events = [];
    let timeouts = [];
    const cancel = () => {
      for (let e of events) {
        e.object.removeListener(e.name, e.listener);
      }
      for (let t of timeouts) {
        clearTimeout(t.timer);
      }
      events = [];
      timeouts = [];
    };
    let resolvePromise = undefined;
    let rejectPromise = undefined;
    const makeListener = (builder, ...args) => {
      const action = builder._action;
      if (action) {
        if (action.resolve) {
          const value = action.value;
          if (value !== undefined) {
            return () => resolvePromise(value);
          }
          return resolvePromise;
        } else if (action.reject) {
          const reason = action.reason;
          if (reason !== undefined) {
            return () => rejectPromise(reason);
          }
          return rejectPromise;
        } else if (action.call) {
          const fn = action.fn;
          return (...eventArgs) => {
            let r = undefined;
            try {
              r = fn(resolvePromise, rejectPromise, ...args, ...eventArgs);
            } catch (err) {
              rejectPromise(err);
              return;
            }
            if (util.types.isPromise(r)) {
              r.catch(err => rejectPromise(err));
            }
          };
        }
      }
    };
    try {
      for (let emitter of this._emitters) {
        for (let event of emitter._events) {
          const listener = makeListener(event);
          if (!listener) {
            throw new Error('Event listener is missing');
          }
          const e = {
            object: emitter._object,
            name: event._name,
            listener
          };
          if (event._once) {
            e.object.once(e.name, e.listener);
          } else {
            e.object.on(e.name, e.listener);
          }
          events.push(e);
        }
      }
      for (let timeout of this._timeouts) {
        const t = {};
        let listener = undefined;
        const delay = timeout._delay;
        const restart = (newDelay) => {
          t.timer = setTimeout(newDelay !== undefined ? newDelay : delay, listener);
        };
        listener = makeListener(timeout, restart);
        if (!listener) {
          listener = () => rejectPromise(new Error('Timeout error'));
        }
        t.timer = setTimeout(listener, delay);
        timeouts.push(t);
      }
      if (!events.length && !timeouts.length) {
        throw Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const fulfilled = false;
        resolvePromise = (value) => {
          if (!fulfilled) {
            fulfilled = true;
            resolve(value);
            cancel();
          }
        };
        rejectPromise = (reason) => {
          if (!fulfilled) {
            fulfilled = true;
            reject(reason);
            cancel();
          }
        };
        this.cancel = cancel;
      });
    } catch (err) {
      cancel();
      throw err;
    }
  }
}

class EventPromise {
  static emitter(object) {
    const b = new PromiseBuilder();
    return b.emitter(object);
  }

  static timeout(delay) {
    const b = new PromiseBuilder();
    return b.timeout(delay);
  }
}

module.exports = {
  EventPromise
};
