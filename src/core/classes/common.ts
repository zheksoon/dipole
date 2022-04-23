import { glob } from "../globals";
import { AnySubscriber, AnySubscription } from "./types";

export const State = {
    NOT_INITIALIZED: 0,
    COMPUTING: 1,
    CLEAN: 2,
    MAYBE_DIRTY: 3,
    DIRTY: 4,
    DESTROYED_BY_PARENT: 5,
} as const;

export function trackSubscriberContext(self: AnySubscription) {
    const subscriber = glob.gSubscriberContext as (AnySubscriber | null);

    if (subscriber !== null) {
        subscriber._subscribeTo(self);
    }
}
