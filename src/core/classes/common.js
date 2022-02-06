import { glob } from "../globals";
import { setGetterSpyResult, gettersSpyContext, gettersNotifyContext } from "../extras";
import { Reaction } from "./reaction";

// Common methods

export function checkSpecialContexts(self) {
    const { gSubscriberContext } = glob;

    if (gSubscriberContext === gettersSpyContext) {
        setGetterSpyResult(self);
        return true;
    }

    if (gSubscriberContext === gettersNotifyContext) {
        self.notify();
        return true;
    }

    return false;
}

export function trackSubscriberContext(self) {
    const subscriber = glob.gSubscriberContext;

    if (subscriber === null) {
        return;
    }

    if (subscriber instanceof Reaction && !subscriber._options.autocommitSubscriptions) {
        subscriber._subscribeTo(self);
        return;
    }

    if (!self._subscribers.has(subscriber)) {
        self._subscribers.add(subscriber);
        subscriber._subscribeTo(self);
    }
}

export function notifySubscribers(self, state) {
    self._subscribers.forEach((subscriber) => {
        subscriber._notify(state, self);
    });
}
