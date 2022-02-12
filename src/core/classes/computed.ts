import { states } from "../constants";
import { untracked } from "../transaction";
import { glob, scheduleSubscribersCheck } from "../globals";
import { trackSubscriberContext } from "./common";
import { checkSpecialContexts } from "../extras";
import {
    AnyComputed,
    AnySubscriber,
    AnySubscription,
    IComputed,
    IComputedImpl,
    IComputedOptions,
    SubscriberState,
} from "./types";

type Options<T> = {
    checkValueFn: null | ((prevValue: T, nextValue: T) => boolean);
    keepAlive: boolean;
};

type ComputedState =
    | typeof states.NOT_INITIALIZED
    | typeof states.CLEAN
    | typeof states.COMPUTING
    | typeof states.MAYBE_DIRTY
    | typeof states.DIRTY;

function getComputedOptions<T>(options?: IComputedOptions<T>): Options<T> {
    const defaultOptions: Options<T> = {
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

export class Computed<T> implements IComputedImpl<T> {
    private _subscribers: Set<AnySubscriber>;
    private _value: undefined | T;
    private _options: Options<T>;
    private _state: ComputedState;
    private _computer: () => T;
    private _subscriptions: AnySubscription[];
    private _maybeDirtySubscriptions: null | AnyComputed[];

    constructor(computer: () => T, options?: IComputedOptions<T>) {
        this._subscribers = new Set();
        this._value = undefined;
        this._options = getComputedOptions(options);
        this._state = states.NOT_INITIALIZED;
        this._computer = computer;
        this._subscriptions = [];
        this._maybeDirtySubscriptions = null;
    }

    get(): T {
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

        return this._value!;
    }

    destroy(): void {
        this._removeSubscriptions();
        this._state = states.NOT_INITIALIZED;
        this._value = undefined;
    }

    _actualizeAndRecompute(): void {
        if (this._state === states.MAYBE_DIRTY) {
            this._actualizeState();
        }

        if (this._state === states.DIRTY || this._state === states.NOT_INITIALIZED) {
            this._recomputeAndCheckValue();
        }
    }

    _actualizeState(): void {
        if (!this._maybeDirtySubscriptions) {
            this._state = states.CLEAN;
            return;
        }

        const actualizedAndNotNotified = (subscription: AnyComputed) => {
            subscription._actualizeAndRecompute();
            return this._state === states.MAYBE_DIRTY;
        };

        if (this._maybeDirtySubscriptions.every(actualizedAndNotNotified)) {
            // we actualized all subscriptions and nobody notified us, so we are clean
            this._state = states.CLEAN;
        }

        this._maybeDirtySubscriptions = null;
    }

    _recomputeAndCheckValue(): void {
        const stateBefore = this._state;
        const value = this._recomputeValue();
        const { checkValueFn } = this._options;

        if (checkValueFn !== null && stateBefore !== states.NOT_INITIALIZED) {
            const isSameValue = untracked(() => checkValueFn(this._value!, value));

            if (isSameValue) return;

            // the value has changed - do the delayed notification of all subscribers
            this._notifySubscribers(states.DIRTY);
        }

        this._value = value;
    }

    _recomputeValue(): T {
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

    _subscribeTo(subscription: AnySubscription): void {
        if (subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _notify(state: SubscriberState, notifier: AnySubscription): void {
        if (this._state >= state) {
            return;
        }

        if (this._options.checkValueFn !== null) {
            if (this._state === states.CLEAN) {
                this._notifySubscribers(states.MAYBE_DIRTY);
            }
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === states.MAYBE_DIRTY) {
            (this._maybeDirtySubscriptions || (this._maybeDirtySubscriptions = [])).push(
                // only computeds may notify us as MAYBE_DIRTY
                notifier as AnyComputed
            );
        } else if (state === states.DIRTY) {
            this._removeSubscriptions();
        }
    }

    _notifySubscribers(state: SubscriberState) {
        this._subscribers.forEach((subscriber) => {
            subscriber._notify(state, this);
        });
    }

    _removeSubscriptions(): void {
        this._subscriptions.forEach((subscription) => {
            subscription._removeSubscriber(this);
        });

        this._subscriptions = [];
        this._maybeDirtySubscriptions = null;
    }

    _addSubscriber(subscriber: AnySubscriber): boolean {
        if (!this._subscribers.has(subscriber)) {
            this._subscribers.add(subscriber);
            return true;
        }

        return false;
    }

    _removeSubscriber(subscriber: AnySubscriber): void {
        this._subscribers.delete(subscriber);
        this._checkSubscribers();
    }

    _hasSubscribers(): boolean {
        return this._subscribers.size !== 0;
    }

    _checkSubscribers(): void {
        if (this._hasSubscribers() || this._options.keepAlive) {
            return;
        }

        scheduleSubscribersCheck(this);
    }
}

export function computed<T>(computer: () => T, options?: IComputedOptions<T>): IComputed<T> {
    return new Computed<T>(computer, options);
}

computed.prop = function computedProp<T>(computer: () => T, options?: IComputedOptions<T>): T {
    return new Computed<T>(computer, options) as unknown as T;
};
