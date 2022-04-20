import { AnyComputed, AnyReaction, AnySubscriber } from "./classes/types";
import { GettersSpyContext, NotifyContext } from "./extras";

const SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL = 1000;
const MAX_REACTION_ITERATIONS = 100;

let gScheduledReactions: (AnyReaction | null)[] = [];
let gScheduledReactionsIndex: number = 0;
let gScheduledStateActualizations: AnyComputed[] = [];
let gScheduledSubscribersChecks: Set<AnyComputed> = new Set();
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

interface GlobalVars {
    gSubscriberContext: GettersSpyContext | NotifyContext | AnySubscriber | null;
    gTransactionDepth: number;
}

interface GlobalConfig {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
    maxReactionIterations: number;
}

export type IConfig = Partial<GlobalConfig>;

export const glob: GlobalVars = {
    gSubscriberContext: null,
    gTransactionDepth: 0,
};

export const gConfig: GlobalConfig = {
    reactionScheduler: (runner) => runner(),
    subscribersCheckInterval: SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL,
    maxReactionIterations: MAX_REACTION_ITERATIONS,
};

export function configure(config: IConfig): void {
    if (config.reactionScheduler) {
        gConfig.reactionScheduler = config.reactionScheduler;
    }
    if (config.subscribersCheckInterval) {
        gConfig.subscribersCheckInterval = config.subscribersCheckInterval;
    }
    if (config.maxReactionIterations) {
        gConfig.maxReactionIterations = config.maxReactionIterations;
    }
}

// Work queues functions

export function scheduleReaction(reaction: AnyReaction) {
    gScheduledReactions.push(reaction);
}

let reactionIterationsLeft = 0;

function runScheduledReactions() {
    let endIndex = gScheduledReactions.length;

    while (gScheduledReactionsIndex < endIndex && reactionIterationsLeft > 0) {
        for (; gScheduledReactionsIndex < endIndex; gScheduledReactionsIndex++) {
            const reaction = gScheduledReactions[gScheduledReactionsIndex];
            gScheduledReactions[gScheduledReactionsIndex] = null;

            if (reaction !== null && reaction._shouldRun()) {
                reaction.runManager();
            }
        }
        endIndex = gScheduledReactions.length;
        reactionIterationsLeft -= 1;
    }

    if (gScheduledReactionsIndex < endIndex && reactionIterationsLeft === 0) {
        console.error("Possible infinite reaction loop: did not converge after 100 iterations");
    }

    gScheduledReactions = [];
    gScheduledReactionsIndex = 0;
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
    for (let computed; (computed = gScheduledStateActualizations.pop()); ) {
        computed._actualizeAndRecompute();
    }
}

let isReactionRunnerScheduled = false;

function shouldRunReactionLoop() {
    return gScheduledReactions.length > 0 || gScheduledStateActualizations.length > 0;
}

function reactionRunner() {
    try {
        isReactionRunnerScheduled = true;

        while (shouldRunReactionLoop()) {
            runScheduledStateActualizations();
            runScheduledReactions();
        }
    } finally {
        isReactionRunnerScheduled = false;
    }
}

export function endTransaction() {
    if (!isReactionRunnerScheduled && shouldRunReactionLoop()) {
        isReactionRunnerScheduled = true;
        reactionIterationsLeft = MAX_REACTION_ITERATIONS;
        gConfig.reactionScheduler(reactionRunner);
    }
}
