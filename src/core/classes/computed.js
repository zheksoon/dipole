import { states } from "../constants";
import { untracked } from "../transaction";
import { glob, scheduleSubscribersCheck } from "../globals";
import { checkSpecialContexts, trackSubscriberContext, notifySubscribers } from "./common";

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

export class Computed {
    constructor(computer, options) {
        this._subscribers = new Set();
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
            this._actualizeAndRecompute();
            trackSubscriberContext(this);

            if (glob.gSubscriberContext === null) {
                this._checkSubscribers();
            }
        }

        return this._value;
    }

    destroy() {
        this._removeSubscriptions();
        this._state = states.NOT_INITIALIZED;
        this._value = undefined;
    }

    _actualizeAndRecompute() {
        if (this._state === states.MAYBE_DIRTY) {
            this._actualizeState();
        }

        if (this._state === states.DIRTY || this._state === states.NOT_INITIALIZED) {
            this._recomputeAndCheckValue();
        }
    }

    _actualizeState() {
        const actualizedAndNotNotified = (subscription) => {
            subscription._actualizeAndRecompute();
            return this._state === states.MAYBE_DIRTY;
        };

        if (this._maybeDirtySubscriptions.every(actualizedAndNotNotified)) {
            // we actualized all subscriptions and nobody notified us, so we are clean
            this._state = states.CLEAN;
        }

        this._maybeDirtySubscriptions = null;
    }

    _recomputeAndCheckValue() {
        const stateBefore = this._state;
        const value = this._recomputeValue();

        if (this._options.checkValueFn !== null && stateBefore !== states.NOT_INITIALIZED) {
            const isSameValue = untracked(() => this._options.checkValueFn(this._value, value));

            if (isSameValue) return;

            // the value has changed - do the delayed notification of all subscribers
            notifySubscribers(this, states.DIRTY);
        }

        this._value = value;
    }

    _recomputeValue() {
        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = this;

        const prevState = this._state;
        this._state = states.COMPUTING;
        try {
            const value = this._computer();
            this._state = states.CLEAN;
            return value;
        } catch (e) {
            this._removeSubscriptions();
            this._state = prevState;
            throw e;
        } finally {
            glob.gSubscriberContext = oldSubscriberContext;
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
                notifySubscribers(this, states.MAYBE_DIRTY);
            }
        } else {
            notifySubscribers(this, state);
        }

        this._state = state;

        if (state === states.MAYBE_DIRTY) {
            (this._maybeDirtySubscriptions || (this._maybeDirtySubscriptions = [])).push(notifier);
        } else if (state === states.DIRTY) {
            this._removeSubscriptions();
        }
    }

    _removeSubscriptions() {
        this._subscriptions.forEach((subscription) => {
            subscription._removeSubscriber(this);
        });

        this._subscriptions = [];
        this._maybeDirtySubscriptions = null;
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);
        this._checkSubscribers();
    }

    _checkSubscribers() {
        if (this._subscribers.size === 0 && !this._options.keepAlive) {
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
