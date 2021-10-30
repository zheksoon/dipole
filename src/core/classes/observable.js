import { glob } from "../globals";
import { states } from "../constants";
import { endTransaction } from "../transaction";
import { Computed } from "./computed";
import {
    getCheckValueFn,
    checkSpecialContexts,
    trackComputedContext,
    notifyAndRemoveSubscribers,
} from "./common";

export class Observable {
    constructor(value, options) {
        this._subscribers = new Set();
        this._value = value;
        this._state = states.CLEAN;
        this._checkValueFn = getCheckValueFn(options);
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

        if (this._checkValueFn !== null && this._checkValueFn(this._value, value)) {
            return;
        }

        this._value = value;

        this.notify();
    }

    notify() {
        notifyAndRemoveSubscribers(this, states.DIRTY, states.CLEAN);

        if (glob.gTransactionDepth === 0) {
            endTransaction();
        }
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);
    }

    _actualizeState() {
        // no op
    }
}

export function observable(value, options) {
    return new Observable(value, options);
}

// declare shorthands for observable props
// the difference is defined in dipole.d.ts
observable.prop = observable;
