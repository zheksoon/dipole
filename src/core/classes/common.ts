import { glob } from "../globals";
import { AnySubscriber, AnySubscription } from "./types";

export function trackSubscriberContext(self: AnySubscription) {
    const subscriber = glob.gSubscriberContext as (AnySubscriber | null);

    if (subscriber !== null) {
        subscriber._subscribeTo(self);
    }
}
