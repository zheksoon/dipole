import { states } from "../constants";
import { untracked } from "../transaction";
import { glob, scheduleSubscribersCheck } from "../globals";
import {
    getCheckValueFn,
    checkSpecialContexts,
    trackComputedContext,
    addMaybeDirtySubscription,
    removeSubscriptions,
    notifySubscribers,
} from "./common";

function actualizeState(self) {
    const actualizedAndNotNotified = (subscription) => {
        subscription._actualizeState();
        return self._state === states.MAYBE_DIRTY;
    };

    if (self._maybeDirtySubscriptions.every(actualizedAndNotNotified)) {
        // we actualized all subscriptions and nobody notified us, so we are clean
        self._state = states.CLEAN;
    }
}

export class Computed {
    constructor(computer, options) {
        this._subscribers = new Set();
        this._value = undefined;
        this._checkValueFn = getCheckValueFn(options);
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
        }

        return this._value;
    }

    destroy() {
        removeSubscriptions(this);
        this._state = states.NOT_INITIALIZED;
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

        if (this._checkValueFn !== null && stateBefore !== states.NOT_INITIALIZED) {
            const isSameValue = untracked(() => this._checkValueFn(this._value, value));

            if (isSameValue) return;

            // the value has changed - do the delayed notification of all subscribers
            notifySubscribers(this, states.DIRTY);
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

        if (this._checkValueFn !== null) {
            if (this._state === states.CLEAN) {
                notifySubscribers(this, states.MAYBE_DIRTY);
            }
        } else {
            notifySubscribers(this, state);
        }

        this._state = state;

        if (state === states.MAYBE_DIRTY) {
            addMaybeDirtySubscription(this, notifier);
        } else if (state === states.DIRTY) {
            removeSubscriptions(this);
        }
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);

        if (this._subscribers.size === 0) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkSubscribers() {
        if (this._subscribers.size === 0) {
            this.destroy();
        }
    }
}

export function computed(computer, options) {
    return new Computed(computer, options);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
computed.prop = computed;
