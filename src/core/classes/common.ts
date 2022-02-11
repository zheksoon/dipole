import { glob } from "../globals";
import { setGetterSpyResult, gettersSpyContext, gettersNotifyContext } from "../extras";
import { AnySubscriber, AnySubscription } from "./types";
import { Observable } from "./observable";

export function checkSpecialContexts(self: AnySubscription) {
    const { gSubscriberContext } = glob;

    if (gSubscriberContext === gettersSpyContext) {
        setGetterSpyResult(self);
        return true;
    }

    if (gSubscriberContext === gettersNotifyContext) {
        if (self instanceof Observable) {
            self.notify();
            return true;
        } else {
            throw new Error("Trying to notify not Observable instance");
        }
    }

    return false;
}

export function trackSubscriberContext(self: AnySubscription) {
    const subscriber = glob.gSubscriberContext as (AnySubscriber | null);

    if (subscriber !== null) {
        subscriber._subscribeTo(self);
    }
}
