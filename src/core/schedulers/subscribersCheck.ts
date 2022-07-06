import { AnyComputed } from "../types";
import { gConfig } from "../globals/config";
import { HashSet } from "../data-structures/hash-set";

let gScheduledSubscribersChecks: HashSet<AnyComputed> = new HashSet();
let gScheduledSubscribersChecksQueue: AnyComputed[] = [];
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSubscribersCheck(computed: AnyComputed) {
    if (gScheduledSubscribersChecks.add(computed)) {
        gScheduledSubscribersChecksQueue.push(computed);

        if (!gScheduledSubscribersCheckTimeout) {
            gScheduledSubscribersCheckTimeout = setTimeout(
                runScheduledSubscribersChecks,
                gConfig.subscribersCheckInterval
            );
        }
    }
}

function runScheduledSubscribersChecks() {
    let computed;
    while ((computed = gScheduledSubscribersChecksQueue.pop())) {
        gScheduledSubscribersChecks.remove(computed);

        if (!computed._hasSubscribers()) {
            computed.destroy();
        }
    }
    gScheduledSubscribersCheckTimeout = null;
}
