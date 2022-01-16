import { glob } from "../globals";
import { states } from "../constants";
import { endTransaction } from "../transaction";
import { Computed } from "./computed";
import { checkSpecialContexts, trackComputedContext, notifySubscribers } from "./common";

function getObservableOptions(options) {
    const defaultOptions = {
        checkValueFn: null,
    };

    if (options && typeof options === "object") {
        if (options.checkValue && typeof options.checkValue === "function") {
            defaultOptions.checkValueFn = options.checkValue;
        }
    }

    return defaultOptions;
}

export class Observable {
    constructor(value, options) {
        this._subscribers = new Set();
        this._value = value;
        this._options = getObservableOptions(options);
    }

    get() {
        if (!checkSpecialContexts(this)) {
            trackComputedContext(this);
        }
        return this._value;
    }

    set(value) {
        if (glob.gComputedContext instanceof Computed) {
            throw new Error("Can't change observable value inside of computed");
        }

        if (this._options.checkValueFn !== null && this._options.checkValueFn(this._value, value)) {
            return;
        }

        this._value = value;

        this.notify();
    }

    notify() {
        notifySubscribers(this, states.DIRTY);

        if (glob.gTransactionDepth === 0) {
            endTransaction();
        }
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);
    }
}

export function observable(value, options) {
    return new Observable(value, options);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
observable.prop = observable;
