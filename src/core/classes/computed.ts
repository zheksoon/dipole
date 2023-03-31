import { untracked, withUntracked } from "../transaction";
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
import { Revision } from "./revision";

type Options<T> = {
    checkValueFn: null | ((prevValue: T, nextValue: T) => boolean);
    keepAlive: boolean;
};

type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.COMPUTING
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.PASSIVE;

function getComputedOptions<T>(options?: IComputedOptions<T>): Options<T> {
    const defaultOptions: Options<T> = {
        checkValueFn: null,
        keepAlive: false,
    };

    if (options && typeof options === "object") {
        if (options.checkValue && typeof options.checkValue === "function") {
            defaultOptions.checkValueFn = withUntracked(options.checkValue);
        }
        defaultOptions.keepAlive = !!options.keepAlive;
    }

    return defaultOptions;
}

export class Computed<T> implements IComputedImpl<T> {
    private declare _subscribers: Set<AnySubscriber>;
    private declare _value: undefined | T;
    private declare _revision: undefined | Revision;
    private declare _options: Options<T>;
    private declare _state: ComputedState;
    private declare _computer: () => T;
    private declare _subscriptions: AnySubscription[];
    private declare _subscriptionsToActualize: null | AnyComputed[];
    private declare _subscriptionRevisions: null | Revision[];

    constructor(computer: () => T, options?: IComputedOptions<T>) {
        this._subscribers = new Set();
        this._value = undefined;
        this._revision = undefined;
        this._options = getComputedOptions(options);
        this._state = State.NOT_INITIALIZED;
        this._computer = computer;
        this._subscriptions = [];
        this._subscriptionsToActualize = null;
        this._subscriptionRevisions = null;
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

    getRevision(): Revision {
        this._actualizeAndRecompute();

        return this._revision!;
    }

    destroy(): void {
        this._removeSubscriptions();
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    _actualizeAndRecompute(): void {
        if (this._state === State.PASSIVE) {
            this._checkRevisions();
        } else if (this._state === State.MAYBE_DIRTY) {
            this._actualizeState();
        }

        if (this._state !== State.CLEAN) {
            this._recomputeAndCheckValue();
        }
    }

    _actualizeState(): void {
        if (this._subscriptionsToActualize !== null) {
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute();
            });
            this._subscriptionsToActualize = null;
        }

        if (this._state === State.MAYBE_DIRTY) {
            // we actualized all subscriptions and nobody notified us, so we are clean
            this._state = State.CLEAN;
        }
    }

    _recomputeAndCheckValue(): void {
        const { checkValueFn } = this._options;
        const shouldCheck = checkValueFn !== null && this._state !== State.NOT_INITIALIZED;
        const value = this._recomputeValue();

        if (shouldCheck) {
            if (checkValueFn!(this._value!, value)) {
                return;
            }

            // the value has changed - do the delayed notification of all subscribers
            this._notifySubscribers(State.DIRTY);
        }

        this._value = value;
        this._revision = new Revision();
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

    _checkRevisions(): void {
        const subscriptions = this._subscriptions;
        const revisions = this._subscriptionRevisions;

        if (revisions === null) {
            return;
        }

        for (let i = 0; i < subscriptions.length; i++) {
            const revision = revisions[i];
            const actualRevision = subscriptions[i].getRevision();

            if (revision !== actualRevision) {
                this._state = State.DIRTY;
                return;
            }
        }

        this._state = State.CLEAN;
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
            if (this._state === State.CLEAN) {
                this._notifySubscribers(State.MAYBE_DIRTY);
            }
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === State.MAYBE_DIRTY) {
            (this._subscriptionsToActualize ||= []).push(notifier);
        } else if (state === State.DIRTY) {
            this._removeSubscriptions();
        }
    }

    _notifySubscribers(state: SubscriberState) {
        this._subscribers.forEach((subscriber) => {
            subscriber._notify(state, this);
        });
    }

    _unsubscribe(): void {
        this._subscriptions.forEach((subscription) => {
            subscription._removeSubscriber(this);
        });
    }

    _removeSubscriptions(): void {
        this._unsubscribe();
        this._subscriptions = [];
        this._subscriptionsToActualize = null;
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
        this._scheduleSubscribersCheck();
    }

    _scheduleSubscribersCheck(): void {
        if (this._subscribers.size === 0 && !this._options.keepAlive) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkSubscribersAndMakePassive(): void {
        if (this._subscribers.size === 0 && this._state !== State.PASSIVE) {
            this._passivate();
        }
    }

    _passivate(): void {
        this._unsubscribe();
        this._subscriptionRevisions = this._subscriptions.map((subs) => subs._getRevision());
        this._state = State.PASSIVE;
    }
}

export function computed<T>(computer: () => T, options?: IComputedOptions<T>): IComputed<T> {
    return new Computed<T>(computer, options);
}

computed.prop = function computedProp<T>(computer: () => T, options?: IComputedOptions<T>): T {
    return new Computed<T>(computer, options) as unknown as T;
};
