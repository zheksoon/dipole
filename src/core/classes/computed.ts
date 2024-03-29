import { untracked } from "../transaction";
import { checkSpecialContexts } from "../extras";
import { State } from "../constants";
import { glob } from "../globals/variables";
import {
    scheduleSubscribersCheck,
    removeFromSubscribersCheck,
} from "../schedulers/subscribersCheck";
import {
    AnyComputed,
    AnySubscriber,
    AnySubscription,
    IComputed,
    IComputedImpl,
    IComputedOptions,
    SubscriberState,
} from "../types";

type Options<T> = {
    checkValueFn: null | ((prevValue: T, nextValue: T) => boolean);
    keepAlive: boolean;
};

type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.COMPUTING
    | State.MAYBE_DIRTY
    | State.DIRTY;

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
    private declare _subscribers: Set<AnySubscriber>;
    private declare _value: undefined | T;
    private declare _options: Options<T>;
    private declare _state: ComputedState;
    private declare _computer: () => T;
    private declare _subscriptions: AnySubscription[];
    private declare _maybeDirtySubscriptions: null | AnyComputed[];

    constructor(computer: () => T, options?: IComputedOptions<T>) {
        this._subscribers = new Set();
        this._value = undefined;
        this._options = getComputedOptions(options);
        this._state = State.NOT_INITIALIZED;
        this._computer = computer;
        this._subscriptions = [];
        this._maybeDirtySubscriptions = null;
    }

    get(): T {
        if (this._state === State.COMPUTING) {
            throw new Error("Trying to get computed value while in computing state");
        }

        const context = glob.gSubscriberContext;

        if (!checkSpecialContexts(context, this)) {
            this._actualizeAndRecompute();

            if (context !== null) {
                context._subscribeTo(this);
            } else {
                this._checkSubscribers();
            }
        }

        return this._value!;
    }

    destroy(): void {
        this._removeSubscriptions();
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    _actualizeAndRecompute(): void {
        if (this._state === State.MAYBE_DIRTY) {
            this._actualizeState();
        }

        if (this._state === State.DIRTY || this._state === State.NOT_INITIALIZED) {
            this._recomputeAndCheckValue();
        }
    }

    _actualizeState(): void {
        const subscriptions = this._maybeDirtySubscriptions;

        const actualizedAndNotNotified = (subscription: AnyComputed) => {
            subscription._actualizeAndRecompute();
            return this._state === State.MAYBE_DIRTY;
        };

        if (!subscriptions || subscriptions.every(actualizedAndNotNotified)) {
            // we actualized all subscriptions and nobody notified us, so we are clean
            this._state = State.CLEAN;
        }

        this._maybeDirtySubscriptions = null;
    }

    _recomputeAndCheckValue(): void {
        const stateBefore = this._state;
        const value = this._recomputeValue();
        const { checkValueFn } = this._options;

        if (checkValueFn !== null && stateBefore !== State.NOT_INITIALIZED) {
            const isSameValue = untracked(() => checkValueFn(this._value!, value));

            if (isSameValue) return;

            // the value has changed - do the delayed notification of all subscribers
            this._notifySubscribers(State.DIRTY);
        }

        this._value = value;
    }

    _recomputeValue(): T {
        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = this;

        const prevState = this._state;
        this._state = State.COMPUTING;
        try {
            const value = this._computer();
            this._state = State.CLEAN;
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

    _addMaybeDirtySubscription(notifier: AnyComputed): void {
        (this._maybeDirtySubscriptions ||= []).push(notifier);
    }

    _notify(state: SubscriberState, notifier: AnySubscription): void {
        if (this._state >= state) {
            return;
        }

        if (this._options.checkValueFn !== null) {
            if (this._state === State.CLEAN) {
                this._notifySubscribers(State.MAYBE_DIRTY);
            }
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === State.MAYBE_DIRTY) {
            this._addMaybeDirtySubscription(notifier as AnyComputed);
        } else if (state === State.DIRTY) {
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
        const subscribers = this._subscribers;
        const subscribersSize = subscribers.size;

        if (subscribersSize === 0) {
            removeFromSubscribersCheck(this);
        }

        return subscribersSize < subscribers.add(subscriber).size;
    }

    _removeSubscriber(subscriber: AnySubscriber): void {
        this._subscribers.delete(subscriber);
        this._checkSubscribers();
    }

    _hasSubscribers(): boolean {
        return this._subscribers.size > 0;
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
