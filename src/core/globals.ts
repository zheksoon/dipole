import { AnyComputed, AnyReaction, AnySubscriber } from "./classes/types";
import { SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL } from "./constants";
import { SpecialContext } from "./extras";

let gScheduledReactions: AnyReaction[] = [];
let gScheduledStateActualizations: AnyComputed[] = [];
let gScheduledSubscribersChecks: Set<AnyComputed> = new Set();
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

type GlobVars = {
    gSubscriberContext:
        | SpecialContext<"GettersSpyContext">
        | SpecialContext<"NotifyContext">
        | AnySubscriber
        | null;
    gTransactionDepth: number;
};

type GlobConfig = {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
};

interface IConfig {
    reactionScheduler?: (runner: () => void) => void;
    subscribersCheckInterval?: number;
}

export const glob: GlobVars = {
    gSubscriberContext: null,
    gTransactionDepth: 0,
};

export const gConfig: GlobConfig = {
    reactionScheduler: (runner: () => void) => runner(),
    subscribersCheckInterval: SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL,
};

export function configure(config: IConfig): void {
    if (config.reactionScheduler) {
        gConfig.reactionScheduler = config.reactionScheduler;
    }
    if (config.subscribersCheckInterval) {
        gConfig.subscribersCheckInterval = config.subscribersCheckInterval;
    }
}

// Work queues functions

export function scheduleReaction(reaction: AnyReaction) {
    gScheduledReactions.push(reaction);
}

export function hasScheduledReactions() {
    return gScheduledReactions.length > 0;
}

export function runScheduledReactions() {
    let reaction;
    while ((reaction = gScheduledReactions.pop())) {
        if (reaction._shouldRun()) {
            reaction.runManager();
        }
    }
}

export function scheduleSubscribersCheck(computed: AnyComputed) {
    gScheduledSubscribersChecks.add(computed);
    if (!gScheduledSubscribersCheckTimeout) {
        gScheduledSubscribersCheckTimeout = setTimeout(
            runScheduledSubscribersChecks,
            gConfig.subscribersCheckInterval
        );
    }
}

export function runScheduledSubscribersChecks() {
    gScheduledSubscribersChecks.forEach((computed) => {
        // delete computed first because it might be reintroduced
        // into the set later in the iteration by `_checkSubscribers` call
        // it's safe to delete and add items into Set while iterating
        gScheduledSubscribersChecks.delete(computed);

        if (computed._hasNoSubscribers()) {
            computed.destroy();
        }
    });
    gScheduledSubscribersCheckTimeout = null;
}

export function scheduleStateActualization(computed: AnyComputed) {
    gScheduledStateActualizations.push(computed);
}

export function hasScheduledStateActualizations() {
    return gScheduledStateActualizations.length > 0;
}

export function runScheduledStateActualizations() {
    let computed;
    while ((computed = gScheduledStateActualizations.pop())) {
        computed._actualizeAndRecompute();
    }
}
