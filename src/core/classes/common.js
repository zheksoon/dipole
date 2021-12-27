import { glob } from "../globals";
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

export function addMaybeDirtySubscription(self, notifier) {
    (self._maybeDirtySubscriptions || (self._maybeDirtySubscriptions = [])).push(notifier);
}

export function removeSubscriptions(self) {
    self._subscriptions.forEach((subscription) => {
        subscription._removeSubscriber(self);
    });

    self._subscriptions = [];

    if (self._maybeDirtySubscriptions) {
        self._maybeDirtySubscriptions = null;
    }
}

export function notifySubscribers(self, subscribersState) {
    self._subscribers.forEach((subscriber) => {
        subscriber._notify(subscribersState, self);
    });
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
