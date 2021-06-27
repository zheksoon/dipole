let gComputedContext = null;
let gScheduledReactions = [];
let gScheduledStateActualizations = [];
let gScheduledSubscribersChecks = new Set();
let gScheduledSubscribersCheckTimeout = null;
let gTransactionDepth = 0;
let gGettersSpyResult = undefined;

const gettersSpyContext = {};
const gettersNotifyContext = {};

const states = {
    NOT_INITIALIZED: 0,
    NOTIFYING: 1,
    COMPUTING: 2,
    CLEAN: 3,
    MAYBE_DIRTY: 4,
    DIRTY: 5,
};
const SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL = 1000;

// Work queues functions

function scheduleReaction(reaction) {
    gScheduledReactions.push(reaction);
}

function runScheduledReactions() {
    let reaction;
    while ((reaction = gScheduledReactions.pop())) {
        reaction.runManager();
    }
}

function scheduleSubscribersCheck(computed) {
    gScheduledSubscribersChecks.add(computed);
    if (!gScheduledSubscribersCheckTimeout) {
        gScheduledSubscribersCheckTimeout = setTimeout(
            runScheduledSubscribersChecks,
            SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL
        );
    }
}

function runScheduledSubscribersChecks() {
    gScheduledSubscribersChecks.forEach((computed) => {
        // delete computed first because it might be reintroduced
        // into the set later in the iteration by `_checkSubscribers` call
        // it's safe to delete and add items into Set while iterating
        gScheduledSubscribersChecks.delete(computed);
        computed._checkSubscribers();
    });
}

function scheduleStateActualization(computed) {
    gScheduledStateActualizations.push(computed);
}

function runScheduledStateActualizations() {
    let computed;
    while ((computed = gScheduledStateActualizations.pop())) {
        computed._actualizeState();
    }
}

// Common methods

function removeSubscriptions(self) {
    self._subscriptions.forEach((subscription) => {
        subscription._removeSubscriber(self);
    });
    self._subscriptions = [];
}

function notifyAndRemoveSubscribers(self, state) {
    this._state = states.NOTIFYING;

    self._subscribers.forEach((subscriber) => {
        subscriber._notify(state);
    });

    if (state === states.DIRTY) {
        self._subscribers.clear();
    }
}

function trackComputedContext(self) {
    // return false if we are in special context
    if (gComputedContext !== null) {
        // handle special context types
        if (gComputedContext === gettersSpyContext) {
            gGettersSpyResult = self;
            return false;
        }
        if (gComputedContext === gettersNotifyContext) {
            self.notify();
            return false;
        }
        if (!self._subscribers.has(gComputedContext)) {
            self._subscribers.add(gComputedContext);
            gComputedContext._subscribeTo(self);
        }
    }
    return true;
}

// Transaction (TX)
function tx(thunk) {
    ++gTransactionDepth;
    try {
        thunk();
    } finally {
        if (--gTransactionDepth === 0) {
            endTransaction();
        }
    }
}

// Untracked Transaction (UTX)
function utx(fn) {
    const oldComputedContext = gComputedContext;
    gComputedContext = null;

    ++gTransactionDepth;
    try {
        return fn();
    } finally {
        if (--gTransactionDepth === 0) {
            endTransaction();
        }
        gComputedContext = oldComputedContext;
    }
}

function untracked(fn) {
    const oldComputedContext = gComputedContext;
    gComputedContext = null;
    try {
        return fn();
    } finally {
        gComputedContext = oldComputedContext;
    }
}

function action(fn) {
    // Do not DRY with `utx()` because of extra work for applying `this` and `arguments` to `fn`
    return function () {
        // actions should not introduce new dependencies when obsesrvables are observed
        const oldComputedContext = gComputedContext;
        gComputedContext = null;

        ++gTransactionDepth;
        try {
            return fn.apply(this, arguments);
        } finally {
            if (--gTransactionDepth === 0) {
                endTransaction();
            }
            gComputedContext = oldComputedContext;
        }
    };
}

function endTransaction() {
    runScheduledStateActualizations();
    runScheduledReactions();
}

function fromGetter(gettersThunk) {
    const oldComputedContext = gComputedContext;
    gComputedContext = gettersSpyContext;
    try {
        gettersThunk();
        return gGettersSpyResult;
    } finally {
        gComputedContext = oldComputedContext;
        gGettersSpyResult = undefined;
    }
}

function notify(gettersThunk) {
    const oldComputedContext = gComputedContext;
    gComputedContext = gettersNotifyContext;
    try {
        tx(gettersThunk);
    } finally {
        gComputedContext = oldComputedContext;
    }
}

function getCheckValueFn(options) {
    if (options && typeof options === "object") {
        const checkValueFn = options.checkValue;
        if (typeof checkValueFn === "function") {
            return checkValueFn;
        }
        // TODO: add shallow-equals dependency
        // } else if (!!checkValueFn) {
        //     return shallowEquals;
        // }
    }
    return null;
}

class Observable {
    constructor(value, options) {
        this._subscribers = new Set();
        this._value = value;
        this._state = states.CLEAN;
        this._checkValueFn = getCheckValueFn(options);
    }

    get() {
        trackComputedContext(this);
        return this._value;
    }

    set(value) {
        if (gComputedContext instanceof Computed) {
            throw new Error("Can't change observable value inside of computed");
        }

        if (this._checkValueFn !== null && this._checkValueFn(this._value, value)) {
            return;
        }

        this._value = value;

        this.notify();
    }

    notify() {
        notifyAndRemoveSubscribers(this, states.DIRTY);
        this._state = states.CLEAN;

        if (gTransactionDepth === 0) {
            endTransaction();
        }
    }

    _removeSubscriber(subscriber) {
        if (this._state === states.NOTIFYING) {
            return; // do not react to unsubscribes when in NOTIFYING state
        }

        this._subscribers.delete(subscriber);
    }

    _actualizeState() {
        // no op
    }
}

class Computed {
    constructor(computer, options) {
        this._subscribers = new Set();
        this._value = undefined;
        this._computer = computer;
        this._checkValueFn = getCheckValueFn(options);
        this._state = states.NOT_INITIALIZED;
        this._subscriptions = [];
    }

    get() {
        if (this._state === states.COMPUTING) {
            throw new Error("Trying to get computed value while in computing state");
        }

        if (!trackComputedContext(this)) {
            // do not trigger recompute if we are in special context
            return this._value;
        }

        if (this._state === states.MAYBE_DIRTY) {
            this._actualizeState();
        }

        if (this._state === states.DIRTY || this._state === states.NOT_INITIALIZED) {
            this._recomputeAndCheckValue();
        }

        return this._value;
    }

    destroy() {
        removeSubscriptions(this);
        this._state = states.NOT_INITIALIZED;
    }

    _actualizeState() {
        if (this._state === states.MAYBE_DIRTY) {
            const subscriptions = this._subscriptions;
            for (let i = 0; i < subscriptions.length; i++) {
                subscriptions[i]._actualizeState();
                if (this._state === states.DIRTY) {
                    break;
                }
            }
            // we actualized all subscriptions and nobody notified us, so we are clean
            if (this._state === states.MAYBE_DIRTY) {
                this._state = states.CLEAN;
            }
        }

        if (this._state === states.DIRTY) {
            this._recomputeAndCheckValue();
        }
    }

    _recomputeAndCheckValue() {
        if (this._checkValueFn !== null && this._state !== states.NOT_INITIALIZED) {
            const value = this._recomputeValue();
            const isSameValue = untracked(() => this._checkValueFn(this._value, value));
            if (!isSameValue) {
                this._value = value;
                // the value has changed - do the delayed notification of all subscribers
                notifyAndRemoveSubscribers(this, states.DIRTY);
                this._state = states.CLEAN;
            }
        } else {
            this._value = this._recomputeValue();
        }
    }

    _recomputeValue() {
        const oldComputedContext = gComputedContext;
        gComputedContext = this;
        const prevState = this._state;
        this._state = states.COMPUTING;
        try {
            const value = this._computer();
            this._state = states.CLEAN;
            return value;
        } catch (e) {
            removeSubscriptions(this);
            this._state = prevState;
            throw e;
        } finally {
            gComputedContext = oldComputedContext;
        }
    }

    _subscribeTo(subscription) {
        this._subscriptions.push(subscription);
    }

    _removeSubscriber(subscriber) {
        if (this._state === states.NOTIFYING) {
            return; // do not react to unsubscribes when in NOTIFYING state
        }

        this._subscribers.delete(subscriber);

        if (this._subscribers.size === 0) {
            scheduleSubscribersCheck(this);
        }
    }

    _notify(state) {
        if (this._state >= state) {
            return;
        }

        if (
            (this._checkValueFn !== null && this._state === states.CLEAN) ||
            (this._checkValueFn === null && state === states.MAYBE_DIRTY)
        ) {
            scheduleStateActualization(this);
        }

        if (this._checkValueFn !== null) {
            if (this._state === states.CLEAN) {
                notifyAndRemoveSubscribers(this, states.MAYBE_DIRTY);
            }
        } else {
            notifyAndRemoveSubscribers(this, state);
        }

        this._state = state;

        if (state === states.DIRTY) {
            removeSubscriptions(this);
        }
    }

    _checkSubscribers() {
        if (this._subscribers.size === 0) {
            this._state = states.NOT_INITIALIZED;
            removeSubscriptions(this);
        }
    }
}

class Reaction {
    constructor(reaction, context, manager) {
        this._reaction = reaction;
        this._context = context || null;
        this._manager = manager;
        this._state = states.DIRTY;
        this._subscriptions = [];
        this._children = [];

        if (gComputedContext !== null && gComputedContext instanceof Reaction) {
            gComputedContext._addChild(this);
        }
    }

    _addChild(child) {
        this._children.push(child);
    }

    _destroyChildren() {
        this._children.forEach((child) => child.destroy());
        this._children = [];
    }

    _notify(state) {
        if (this._state === states.CLEAN && state === states.DIRTY) {
            this._state = states.DIRTY;
            scheduleReaction(this);
        }
    }

    _subscribeTo(subscription) {
        this._subscriptions.push(subscription);
    }

    runManager() {
        if (this._manager) {
            removeSubscriptions(this);
            return this._manager();
        } else {
            return this.run();
        }
    }

    run() {
        this._destroyChildren();
        removeSubscriptions(this);

        const oldComputedContext = gComputedContext;
        gComputedContext = this;

        ++gTransactionDepth;

        try {
            this._state = states.CLEAN;
            return this._reaction.apply(this._context, arguments);
        } finally {
            gComputedContext = oldComputedContext;
            // if we are about to end all transactions, run the rest of reactions inside it
            if (gTransactionDepth === 1) {
                endTransaction();
            }
            --gTransactionDepth;
        }
    }

    destroy() {
        this._destroyChildren();
        removeSubscriptions(this);
        this._state = states.DIRTY;
    }
}

function observable(value, options) {
    return new Observable(value, options);
}

function computed(computer, options) {
    return new Computed(computer, options);
}

function reaction(reactor, context, manager) {
    return new Reaction(reactor, context, manager);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
observable.prop = observable;
computed.prop = computed;

export {
    Observable,
    observable,
    Computed,
    computed,
    Reaction,
    reaction,
    tx,
    utx,
    action,
    fromGetter,
    notify,
};
