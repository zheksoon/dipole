import { states } from "../constants";
import { untracked } from "../transaction";
import { glob, scheduleSubscribersCheck } from "../globals";
import { HashSet } from "../data-structures/hash-set";
import { randomInt } from "../utils/random";
import {
    checkSpecialContexts,
    trackComputedContext,
    addMaybeDirtySubscription,
    removeSubscriptions,
    notifySubscribers,
} from "./common";

function getComputedOptions(options) {
    const defaultOptions = {
        checkValueFn: null,
        keepAlive: false,
    };

    if (options && typeof options === "object") {
        if (options.checkValue && typeof options.checkValue === "function") {
            defaultOptions.checkValueFn = options.checkValue;
        }
        defaultOptions.keepAlive = !!options.keepAlive;
    }

    return defaultOptions;
}

function actualizeState(self) {
    const actualizedAndNotNotified = (subscription) => {
        subscription._actualizeState();
        return self._state === states.MAYBE_DIRTY;
    };

    if (self._maybeDirtySubscriptions.every(actualizedAndNotNotified)) {
        // we actualized all subscriptions and nobody notified us, so we are clean
        self._state = states.CLEAN;
    }

    self._maybeDirtySubscriptions = null;
}

export class Computed {
    constructor(computer, options) {
        this._hash = randomInt();
        this._subscribers = new HashSet();
        this._value = undefined;
        this._options = getComputedOptions(options);
        this._state = states.NOT_INITIALIZED;
        this._computer = computer;
        this._subscriptions = [];
        this._maybeDirtySubscriptions = null;
    }

    get() {
        if (this._state === states.COMPUTING) {
            throw new Error("Trying to get computed value while in computing state");
        }

        if (!checkSpecialContexts(this)) {
            this._actualizeState();
            trackComputedContext(this);

            if (glob.gComputedContext === null) {
                this._checkSubscribers();
            }
        }

        return this._value;
    }

    destroy() {
        removeSubscriptions(this);
        this._state = states.NOT_INITIALIZED;
        this._value = undefined;
    }

    _actualizeState() {
        if (this._state === states.MAYBE_DIRTY) {
            actualizeState(this);
        }

        if (this._state === states.DIRTY || this._state === states.NOT_INITIALIZED) {
            this._recomputeAndCheckValue();
        }
    }

    _recomputeAndCheckValue() {
        const stateBefore = this._state;
        const value = this._recomputeValue();

        if (this._options.checkValueFn !== null && stateBefore !== states.NOT_INITIALIZED) {
            const isSameValue = untracked(() => this._options.checkValueFn(this._value, value));

            if (isSameValue) return;

            // the value has changed - do the delayed notification of all subscribers
            notifySubscribers(this, states.DIRTY, true);
        }

        this._value = value;
    }

    _recomputeValue() {
        const oldComputedContext = glob.gComputedContext;
        glob.gComputedContext = this;

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
            glob.gComputedContext = oldComputedContext;
        }
    }

    _subscribeTo(subscription) {
        this._subscriptions.push(subscription);
    }

    _notify(state, notifier) {
        if (this._state >= state) {
            return;
        }

        if (this._options.checkValueFn !== null) {
            if (this._state === states.CLEAN) {
                notifySubscribers(this, states.MAYBE_DIRTY, false);
            }
        } else {
            notifySubscribers(this, state, state === states.DIRTY);
        }

        this._state = state;

        if (state === states.MAYBE_DIRTY) {
            addMaybeDirtySubscription(this, notifier);
        } else if (state === states.DIRTY) {
            removeSubscriptions(this);
        }
    }

    _removeSubscriber(subscriber) {
        this._subscribers.remove(subscriber);
        this._checkSubscribers();
    }

    _checkSubscribers() {
        if (this._subscribers.size() === 0 && !this._options.keepAlive) {
            scheduleSubscribersCheck(this);
        }
    }
}

export function computed(computer, options) {
    return new Computed(computer, options);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
computed.prop = computed;
