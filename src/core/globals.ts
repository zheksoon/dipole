import { AnyComputed, AnyReaction, AnySubscriber } from "./classes/types";
import { SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL } from "./constants";
import { GettersSpyContext, NotifyContext } from "./extras";

let gScheduledReactions: AnyReaction[] = [];
let gScheduledStateActualizations: AnyComputed[] = [];
let gScheduledSubscribersChecks: Set<AnyComputed> = new Set();
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

type GlobVars = {
    gSubscriberContext: GettersSpyContext | NotifyContext | AnySubscriber | null;
    gTransactionDepth: number;
};

type GlobConfig = {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
};

export interface IConfig {
    reactionScheduler?: (runner: () => void) => void;
    subscribersCheckInterval?: number;
}

export const glob: GlobVars = {
    gSubscriberContext: null,
    gTransactionDepth: 0,
};

export const gConfig: GlobConfig = {
    reactionScheduler: (runner) => runner(),
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

function runScheduledReactions() {
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

export function scheduleStateActualization(computed: AnyComputed) {
    gScheduledStateActualizations.push(computed);
}

function runScheduledStateActualizations() {
    let computed;
    while ((computed = gScheduledStateActualizations.pop())) {
        computed._actualizeAndRecompute();
    }
}

let isReactionRunnerScheduled = false;

function shouldRunReactionLoop() {
    return gScheduledReactions.length > 0 || gScheduledStateActualizations.length > 0;
}

function reactionRunner() {
    while (shouldRunReactionLoop()) {
        runScheduledStateActualizations();
        runScheduledReactions();
    }
    isReactionRunnerScheduled = false;
}

export function endTransaction() {
    if (!isReactionRunnerScheduled && shouldRunReactionLoop()) {
        isReactionRunnerScheduled = true;
        gConfig.reactionScheduler(reactionRunner);
    }
}
