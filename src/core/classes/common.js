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
        subscriber._notify(subscribersState, self);
    });

    self._state = newOwnState;
}

export function actualizeState(self) {
    const actualizeAndCheckSelf = (subscription) => {
        subscription._actualizeState();
        return self._state === states.MAYBE_DIRTY;
    };

    // we actualized all subscriptions and nobody notified us, so we are clean
    if (!self._subscriptions.some(actualizeAndCheckSelf)) {
        self._state = states.CLEAN;
    }
}

export function getCheckValueFn(options) {
    if (options && typeof options === "object") {
        const checkValueFn = options.checkValue;
        if (typeof checkValueFn === "function") {
            return checkValueFn;
        }
    }
    return null;
}
