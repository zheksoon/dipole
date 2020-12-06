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
        reaction.runManager();
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
            const subscribersCount = self._subscribers.size();
            if (subscribersCount > self._maxSubscribersCount) {
                self._maxSubscribersCount = subscribersCount
            }
            gComputedContext._subscribeTo(self);
        }
    }
}

function notifyAndRemoveSubscribers(self) {
    const subscribersSet = self._subscribers;
    const subscribers = subscribersSet.items();
    // plan HashSet capacity for the new round
    const desiredStorageSize = subscribersSet.getDesiredStorageSize(self._maxSubscribersCount);
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
    subscribersSet._size = 0;
    subscribersSet.setStorageSize(desiredStorageSize);
    // reset capacity counter
    self._maxSubscribersCount = 0;
}

function tx(thunk) {
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

function action(fn) {
    return function() {
        // actions should not introduce new dependencies when obsesrvables are observed
        const oldComputedContext = gComputedContext;
        gComputedContext = null;

        ++gTransactionDepth;
        try {
            return fn.apply(this, arguments)
        }
        finally {
            if (--gTransactionDepth === 0) {
                endTransaction();
            }
            gComputedContext = oldComputedContext;
        }
    }
}

function untracked(fn) {
    const oldComputedContext = gComputedContext;
    gComputedContext = null;
    try {
        return fn();
    }
    finally {
        gComputedContext = oldComputedContext;
    }
}

function endTransaction() {
    runScheduledReactions();
    runScheduledSubscribersChecks();
}

class Observable {
    constructor(value) {
        this._subscribers = new HashSet();
        this._maxSubscribersCount = 0;
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

        this.notify()
    }

    notify() {
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
        this._maxSubscribersCount = 0;
        this._value = undefined;
        this._subscriptions = [];
        this._computer = computer;
        this._state = states.DIRTY;
    }

    get() {
        this._checkComputingState()

        trackComputedContext(this);

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

    _checkComputingState() {
        if (this._state === states.COMPUTING) {
            throw new Error("Trying to get computed value while in computing state");
        }
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
            this._state = states.DIRTY;
            removeSubscriptions(this);
        }
    }
}

class Reaction {
    constructor(reaction, context, manager) {
        this._hash = randomInt();
        this._subscriptions = [];
        this._state = states.DIRTY;
        this._reaction = reaction;
        this._context = context || null;
        this._manager = manager;
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
        this._state = states.DIRTY;
        runScheduledSubscribersChecks();
    }
}

function observable(value) {
    return new Observable(value)
}

function computed(computer) {
    return new Computed(computer)
}

function reaction(reactor, context, manager) {
    return new Reaction(reactor, context, manager)
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
observable.prop = observable;
computed.prop = computed;

function makeObservable(obj) {
    const descriptors = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const prop = obj[key];
            if (prop instanceof Observable) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        return prop.get()
                    },
                    set(value) {
                        prop.set(value)
                    },
                })
            } else if (prop instanceof Computed) {
                descriptors.push({
                    key: key,
                    enumerable: true,
                    configurable: true,
                    get() {
                        return prop.get()
                    },
                })
            }
        }
    }
    for (let i = 0; i < descriptors.length; i++) {
        const descriptor = descriptors[i];
        Object.defineProperty(obj, descriptor.key, descriptor);
    }
    return obj;
}

export {
    Observable,
    observable,
    Computed,
    computed,
    Reaction,
    reaction,
    tx,
    action,
    untracked,
    makeObservable,
}
