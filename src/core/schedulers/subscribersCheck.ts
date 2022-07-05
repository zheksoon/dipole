import { AnyComputed } from "../types";
import { gConfig } from "../globals/config";

let gScheduledSubscribersChecks: Set<AnyComputed> = new Set();
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSubscribersCheck(computed: AnyComputed) {
    gScheduledSubscribersChecks.add(computed);

    if (!gScheduledSubscribersCheckTimeout) {
        gScheduledSubscribersCheckTimeout = setTimeout(
            runScheduledSubscribersChecks,
            gConfig.subscribersCheckInterval
        );
    }
}

function runScheduledSubscribersChecks() {
    gScheduledSubscribersChecks.forEach((computed) => {
        // delete computed first because it might be reintroduced
        // into the set later in the iteration by `_checkSubscribers` call
        // it's safe to delete and add items into Set while iterating
        gScheduledSubscribersChecks.delete(computed);

        if (!computed._hasSubscribers()) {
            computed.destroy();
        }
    });
    gScheduledSubscribersCheckTimeout = null;
}
