import { states } from "../constants";
import { untracked } from "../transaction";
import { glob, scheduleSubscribersCheck } from "../globals";
import {
    getCheckValueFn,
    checkSpecialContexts,
    trackComputedContext,
    removeSubscriptions,
    actualizeState,
    notifyAndRemoveSubscribers,
} from "./common";

export class Computed {
    constructor(computer, options) {
        this._subscribers = new Set();
        this._value = undefined;
        this._state = states.NOT_INITIALIZED;
        this._checkValueFn = getCheckValueFn(options);
        this._computer = computer;
        this._subscriptions = [];
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
        if (this._checkValueFn !== null && this._state !== states.NOT_INITIALIZED) {
            const value = this._recomputeValue();
            const isSameValue = untracked(() => this._checkValueFn(this._value, value));
            if (!isSameValue) {
                this._value = value;
                // the value has changed - do the delayed notification of all subscribers
                notifyAndRemoveSubscribers(this, states.DIRTY, states.CLEAN);
            }
        } else {
            this._value = this._recomputeValue();
        }
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

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);

        if (this._subscribers.size === 0) {
            scheduleSubscribersCheck(this);
        }
    }

    _notify(state) {
        if (this._state >= state) {
            return;
        }

        if (this._checkValueFn !== null) {
            if (this._state === states.CLEAN) {
                notifyAndRemoveSubscribers(this, states.MAYBE_DIRTY, state);
            } else {
                this._state = state;
            }
        } else {
            notifyAndRemoveSubscribers(this, state, state);
        }

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

export function computed(computer, options) {
    return new Computed(computer, options);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
computed.prop = computed;
