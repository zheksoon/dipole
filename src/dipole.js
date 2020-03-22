import { randomInt } from './utils/random';
import HashSet from './utils/hash-set';

let gComputedContext = null;
let gScheduledReactions = [];
let gScheduledSubscribersChecks = [];
let gTransactionDepth = 0;

const states = {
    CLEAN: 0,
    DIRTY: 1,
    NOTIFYING: 2,
    COMPUTING: 3,
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
        if (self._subscribers.add(gComputedContext)) {
            gComputedContext._subscribeTo(self);
        }
    }
}

function notifyAndRemoveSubscribers(self) {
    const subscribers = self._subscribers.items();
    // destructively iterate through subscribers HashSet
    // the subscribers HashSet is broken during the iteration,
    // so we must check state when trying to use it
    for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];
        if (subscriber !== undefined) {
            subscriber._notify();
            subscribers[i] = undefined;
        }
    }
    self._subscribers._size = 0;
}

function transaction(thunk) {
    ++gTransactionDepth;
    try {
        thunk();
    }
    finally {
        if (--gTransactionDepth === 0) {
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
        this._subscribers = new HashSet();
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

        this._state = states.NOTIFYING;
        notifyAndRemoveSubscribers(this);
        this._state = states.CLEAN;

        if (gTransactionDepth === 0)  {
            endTransaction();
        }
    }

    _unsubscribe(subscriber) {
        if (this._state === states.NOTIFYING) return;

        this._subscribers.remove(subscriber);
    }
}

class Computed {
    constructor(computer) {
        this._hash = randomInt();
        this._subscribers = new HashSet();
        this._value = undefined;
        this._subscriptions = [];
        this._computer = computer;
        this._state = states.DIRTY;
    }

    get() {
        if (this._state === states.COMPUTING) {
            throw new Error("Trying to get computed value while in computing state");
        }

        trackComputedContext(this);

        if (this._state === states.CLEAN) {
            return this._value;
        }        

        return this._recomputeValue()
    }

    _recomputeValue() {
        const oldComputedContext = gComputedContext;
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
        // do not react to unsubscribes when in NOTIFYING state,
        // as _subscribers HashSet is broken
        if (this._state === states.NOTIFYING) return;

        this._subscribers.remove(subscriber);
        if (this._subscribers.size() === 0) {
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
        if (this._subscribers.size() === 0) {
            removeSubscriptions(this);
            this._state = states.DIRTY;
        }
    }
}

class Reaction {
    constructor(reaction) {
        this._hash = randomInt();
        this._subscriptions = [];
        this._state = states.DIRTY;
        this._reaction = reaction;
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

    run() {
        removeSubscriptions(this);

        const oldComputedContext = gComputedContext;
        gComputedContext = this;
        
        ++gTransactionDepth;

        try {
            this._state = states.CLEAN;
            this._reaction();
            // return itself for simpler chaining like `const r = new Reaction(() => {}).run()`
            return this;
        }
        finally {
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
        this._state = states.CLEAN;
        runScheduledSubscribersChecks();
    }
}

export {
    Observable,
    Computed,
    Reaction,
    transaction,
}
