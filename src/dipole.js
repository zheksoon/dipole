let gComputedContext = null;
let gScheduledReactions = [];
let gScheduledSubscribersChecks = [];
let gTransactionDepth = 0;

const states = {
    CLEAN: 0,
    DIRTY: 1,
    COMPUTING: 2,
}

// Helper functions

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
            self._subscribers.add(gComputedContext);
            gComputedContext._subscribeTo(self);
        }
    }
}

function notifyAndRemoveSubscribers(self) {
    self._subscribers.forEach(subscriber => {
        subscriber._notify();
    });
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
        notifyAndRemoveSubscribers(this);

        if (gTransactionDepth == 0) {
            endTransaction();
        }
    }

    _unsubscribe(subscriber) {
        this._subscribers.delete(subscriber);
    }
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
        this._subscribers.delete(subscriber);
        if (this._subscribers.size == 0) {
            scheduleSubscribersCheck(this);
        }
    }

    _notify() {
        if (this._state == states.CLEAN) {
            this._state = states.DIRTY;
            notifyAndRemoveSubscribers(this);
            removeSubscriptions(this);
        }
    }

    _checkSubscribers() {
        if (this._subscribers.size == 0) {
            removeSubscriptions(this);
            this._state = states.DIRTY;
        }
    }
}

class Reaction {
    constructor(reaction) {
        this._subscriptions = [];
        this._state = states.DIRTY;
        this._reaction = reaction;
    }

    _notify() {
        if (this._state == states.CLEAN) {
            this._state = states.DIRTY;
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

        removeSubscriptions(this);

        let oldComputedContext = gComputedContext;
        gComputedContext = this;
        
        ++gTransactionDepth;

        try {
            this._state = states.CLEAN;
            this._reaction();
        }
        catch (e) {
            this.state = states.DIRTY;
            throw e;
        }
        finally {
            gComputedContext = oldComputedContext;
            // if we are about to end all transactions, run the rest of reactions inside it
            if (gTransactionDepth == 1) {
                endTransaction();
            }
            --gTransactionDepth;
        }
    }

    destroy() {
        // TODO: schedule execution of scheduled subscriptions removes after the call
        removeSubscriptions(this);
        this.state = states.CLEAN;
    }
}

module.exports = {
    Observable,
    Computed,
    Reaction,
    transaction,
}