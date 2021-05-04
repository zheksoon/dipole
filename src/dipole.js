let gComputedContext = null;
let gScheduledReactions = [];
let gScheduledSubscribersChecks = [];
let gTransactionDepth = 0;
let gGettersSpyResult = undefined;

const gettersSpyContext = {};
const gettersNotifyContext = {};

const states = {
    CLEAN: 0,
    DIRTY: 1,
    NOTIFYING: 2,
    COMPUTING: 3,
};

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

function scheduleSubscribersCheck(notifier) {
    gScheduledSubscribersChecks.push(notifier);
}

function runScheduledSubscribersChecks() {
    let notifier;
    while ((notifier = gScheduledSubscribersChecks.pop())) {
        notifier._checkSubscribers();
    }
}

// Common methods

function removeSubscriptions(self) {
    self._subscriptions.forEach((subscription) => {
        subscription._removeSubscriber(self);
    });
    self._subscriptions = [];
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

function notifyAndRemoveSubscribers(self) {
    self._subscribers.forEach((subscriber) => {
        subscriber._notify();
    });
    self._subscribers.clear();
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

function endTransaction() {
    runScheduledReactions();
    runScheduledSubscribersChecks();
}

class Observable {
    constructor(value) {
        this._subscribers = new Set();
        this._value = value;
        this._state = states.CLEAN;
    }

    get() {
        trackComputedContext(this);
        return this._value;
    }

    set(value) {
        if (gComputedContext instanceof Computed) {
            throw new Error("Can't change observable value inside of computed");
        }

        this._value = value;

        this.notify();
    }

    notify() {
        this._state = states.NOTIFYING;
        notifyAndRemoveSubscribers(this);
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
}

class Computed {
    constructor(computer) {
        this._subscribers = new Set();
        this._value = undefined;
        this._computer = computer;
        this._state = states.DIRTY;
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

        if (this._state === states.CLEAN) {
            return this._value;
        }

        return this._recomputeValue();
    }

    destroy() {
        removeSubscriptions(this);
        this._state = states.DIRTY;
        runScheduledSubscribersChecks();
    }

    _recomputeValue() {
        const oldComputedContext = gComputedContext;
        gComputedContext = this;
        this._state = states.COMPUTING;
        try {
            this._value = this._computer();
            this._state = states.CLEAN;
            return this._value;
        } catch (e) {
            this._state = states.DIRTY;
            throw e;
        } finally {
            gComputedContext = oldComputedContext;
        }
    }

    _subscribeTo(notifier) {
        this._subscriptions.push(notifier);
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

    _notify() {
        if (this._state === states.CLEAN) {
            this._state = states.NOTIFYING;
            notifyAndRemoveSubscribers(this);
            this._state = states.DIRTY;
            removeSubscriptions(this);
        }
    }

    _checkSubscribers() {
        if (this._subscribers.size === 0) {
            this._state = states.DIRTY;
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
    }

    _notify() {
        if (this._state === states.CLEAN) {
            this._state = states.DIRTY;
            scheduleReaction(this);
        }
    }

    _subscribeTo(notifier) {
        this._subscriptions.push(notifier);
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
        removeSubscriptions(this);
        this._state = states.DIRTY;
        runScheduledSubscribersChecks();
    }
}

function observable(value) {
    return new Observable(value);
}

function computed(computer) {
    return new Computed(computer);
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
