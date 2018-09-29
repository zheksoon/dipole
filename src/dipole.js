let gComputedContext = null;
let gScheduledSubscriptionsRemoves = [];
let gScheduledReactions = [];
let gScheduledSubscribersChecks = [];
let gTransactionDepth = 0;

const states = {
    CLEAN: 0,
    MAYBE_DIRTY: 1,
    DIRTY: 2,
    COMPUTING: 3,
    RUNNING: 4,
}

// Helper functions

function scheduleSubscriptionsRemove(subscriber) {
    gScheduledSubscriptionsRemoves.push(subscriber);
}

function runScheduledSubscriptionsRemoves() {
    let subscriber;
    while (subscriber = gScheduledSubscriptionsRemoves.pop()) {
        removeSubscriptions(subscriber);
    }
}

function scheduleReaction(reaction) {
    gScheduledReactions.push(reaction);
}

function runScheduledReactions() {
    let reaction;
    while (reaction = gScheduledReactions.pop()) {
        reaction.run();
    }
}

function scheduleSubscribersCheck(notifier) {
    gScheduledSubscribersChecks.push(notifier);
}

function runScheduledSubscribersChecks() {
    let notifier;
    while (notifier = gScheduledSubscribersChecks.pop()) {
        notifier._checkSubscribers();
    }
}

// Common methods

function removeSubscriptions(self) {
    let subscription;
    while (subscription = self._subscriptions.pop()) {
        subscription._unsubscribe(self);
    }
}

function trackComputedContext(self) {
    if (gComputedContext !== null) {
        if (!self._subscribers.has(gComputedContext)) {
            // console.log(`Subscribing ${gComputedContext} to ${self}`);
            self._subscribers.add(gComputedContext);
            gComputedContext._subscribeTo(self);
        }
    }
}

function notifyAndRemoveSubscribers(self, state) {
    // avoid closure creation by using `this` for passing `state` var into iterator
    self._subscribers.forEach(function (subscriber) {
        subscriber._notify(this);
    }, state);
    self._subscribers.clear();
}

function transaction(thunk) {
    ++gTransactionDepth;
    try {
        thunk();
    }
    finally {
        if (--gTransactionDepth == 0) {
            endTransaction();
        }
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
    }

    get() {
        trackComputedContext(this);
        return this._value;
    }

    set(value) {
        if (gComputedContext instanceof Computed) {
            throw new Error(`Can't change observable value inside of computed`);
        }

        this._value = value;
        notifyAndRemoveSubscribers(this, states.DIRTY);

        runScheduledSubscriptionsRemoves();

        if (gTransactionDepth == 0) {
            endTransaction();
        }
    }

    _unsubscribe(subscriber) {
        // console.log(`Removing ${subscriber} from ${this}`)
        this._subscribers.delete(subscriber);
    }

    // toString() {
    //     return `Observable { ${this._value} }`
    // }
}

class Computed {
    constructor(computer) {
        this._subscribers = new Set();
        this._value = undefined;
        this._subscriptions = [];
        this._computer = computer;
        this._state = states.DIRTY;
    }

    get() {
        if (this._state == states.COMPUTING) {
            throw new Error(`Trying to get computed value while in computing state`);
        }

        trackComputedContext(this);

        if (this._state == states.CLEAN) {
            return this._value;
        }        

        let oldComputedContext = gComputedContext;
        gComputedContext = this;
        this._state = states.COMPUTING;
        try {
            this._value = this._computer();
            this._state = states.CLEAN;
            return this._value;
        }
        catch (e) {
            this._state = states.DIRTY;
            throw e;
        }
        finally {
            gComputedContext = oldComputedContext;
        }
    }

    _subscribeTo(notifier) {
        this._subscriptions.push(notifier);
    }

    _unsubscribe(subscriber) {
        // console.log(`Removing ${subscriber} from ${this}`)
        this._subscribers.delete(subscriber);
        if (this._subscribers.size == 0) {
            scheduleSubscribersCheck(this);
        }
    }

    _notify(state) {
        if (this._state == states.CLEAN) {
            this._state = state;
            notifyAndRemoveSubscribers(this, state);
            scheduleSubscriptionsRemove(this);
        }
    }

    _checkSubscribers() {
        if (this._subscribers.size == 0) {
            removeSubscriptions(this);
            this._state = states.DIRTY;
        }
    }

    // toString() {
    //     return `Computed { ${this._computer}, ${this._value} }`
    // }
}

class Reaction {
    constructor(reaction) {
        this._subscriptions = [];
        this._state = states.DIRTY;
        this._reaction = reaction;
    }

    _notify(state) {
        if (this._state == states.CLEAN) {
            this._state = state;
            scheduleSubscriptionsRemove(this);
            scheduleReaction(this);
        }
    }

    _subscribeTo(notifier) {
        this._subscriptions.push(notifier);
    }

    run() {
        if (this._state == states.CLEAN) {
            return;
        }

        let oldComputedContext = gComputedContext;
        gComputedContext = this;
        
        try {
            this._reaction();
            this._state = states.CLEAN;
            return this;
        }
        finally {
            gComputedContext = oldComputedContext;
        }
    }

    // toString() {
    //     return `Reaction { ${this._reaction} }`
    // }
}

module.exports = {
    Observable,
    Computed,
    Reaction,
    transaction,
}