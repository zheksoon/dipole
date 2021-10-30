import { glob } from "../globals";
import { states } from "../constants";
import { setGetterSpyResult, gettersSpyContext, gettersNotifyContext } from "../extras";

// Common methods

export function checkSpecialContexts(self) {
    const { gComputedContext } = glob;
    if (gComputedContext === gettersSpyContext) {
        setGetterSpyResult(self);
        return true;
    }
    if (gComputedContext === gettersNotifyContext) {
        self.notify();
        return true;
    }
    return false;
}

export function trackComputedContext(self) {
    const { gComputedContext } = glob;
    if (gComputedContext !== null) {
        if (!self._subscribers.has(gComputedContext)) {
            self._subscribers.add(gComputedContext);
            gComputedContext._subscribeTo(self);
        }
    }
}

export function removeSubscriptions(self) {
    self._subscriptions.forEach((subscription) => {
        subscription._removeSubscriber(self);
    });
    self._subscriptions = [];
}

export function notifyAndRemoveSubscribers(self, subscribersState, newOwnState) {
    self._subscribers.forEach((subscriber) => {
        subscriber._notify(subscribersState);
    });

    self._state = newOwnState;
}

export function actualizeState(self) {
    const subscriptions = self._subscriptions;
    for (let i = 0; i < subscriptions.length; i++) {
        subscriptions[i]._actualizeState();
        if (self._state === states.DIRTY) {
            break;
        }
    }
    // we actualized all subscriptions and nobody notified us, so we are clean
    if (self._state === states.MAYBE_DIRTY) {
        self._state = states.CLEAN;
    }
}

export function getCheckValueFn(options) {
    if (options && typeof options === "object") {
        const checkValueFn = options.checkValue;
        if (typeof checkValueFn === "function") {
            return checkValueFn;
        }
        // TODO: add shallow-equals dependency
        // } else if (!!checkValueFn) {
        //     return shallowEquals;
        // }
    }
    return null;
}