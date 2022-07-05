import { Computed } from "./computed";
import { State } from "../constants";
import { checkSpecialContexts } from "../extras";
import { glob } from "../globals/variables";
import { endTransaction } from "../schedulers/reaction";
import {
    AnySubscriber,
    IObservable,
    IObservableImpl,
    IObservableOptions,
    SubscriberState,
} from "../types";

type Options<T> = {
    checkValueFn: null | ((prevValue: T, nextValue: T) => boolean);
};

function getObservableOptions<T>(options?: IObservableOptions<T>): Options<T> {
    const defaultOptions: Options<T> = {
        checkValueFn: null,
    };

    if (options && typeof options === "object") {
        if (options.checkValue && typeof options.checkValue === "function") {
            defaultOptions.checkValueFn = options.checkValue;
        }
    }

    return defaultOptions;
}

export class Observable<T> implements IObservableImpl<T> {
    private _subscribers: Set<AnySubscriber>;
    private _value: T;
    private _options: Options<T>;

    constructor(value: T, options?: IObservableOptions<T>) {
        this._subscribers = new Set();
        this._value = value;
        this._options = getObservableOptions(options);
    }

    get(): T {
        const context = glob.gSubscriberContext;

        if (context !== null && !checkSpecialContexts(context, this)) {
            context._subscribeTo(this);
        }
        return this._value;
    }

    set(value: T): void {
        if (glob.gSubscriberContext instanceof Computed) {
            throw new Error("Can't change observable value inside of computed");
        }

        if (this._options.checkValueFn !== null && this._options.checkValueFn(this._value, value)) {
            return;
        }

        this._value = value;

        this.notify();
    }

    notify(): void {
        this._notifySubscribers(State.DIRTY);

        if (glob.gTransactionDepth === 0) {
            endTransaction();
        }
    }

    _notifySubscribers(state: SubscriberState): void {
        this._subscribers.forEach((subscriber) => {
            subscriber._notify(state, this);
        });
    }

    _addSubscriber(subscriber: AnySubscriber): boolean {
        const subscribers = this._subscribers;
        return subscribers.size < subscribers.add(subscriber).size;
    }

    _removeSubscriber(subscriber: AnySubscriber): void {
        this._subscribers.delete(subscriber);
    }
}

export function observable<T>(value: T, options?: IObservableOptions<T>): IObservable<T> {
    return new Observable<T>(value, options);
}

observable.prop = function observableProp<T>(value: T, options?: IObservableOptions<T>): T {
    return new Observable<T>(value, options) as unknown as T;
};
