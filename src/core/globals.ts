import { AnyComputed, AnyReaction, AnySubscriber } from "./classes/types";
import { HashSet } from "./data-structures/hash-set";
import { GettersSpyContext, NotifyContext } from "./extras";

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

const SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL = 1000;
const MAX_REACTION_ITERATIONS = 100;
const DEFAULT_REACTION_RUNNER: GlobalConfig["reactionScheduler"] = (runner) => runner();

let gScheduledReactions: (AnyReaction | null)[] = [];
let gScheduledReactionsIndex: number = 0;
let gScheduledStateActualizations: AnyComputed[] = [];
let gScheduledSubscribersChecks: HashSet<AnyComputed> = new HashSet();
let gScheduledSubscribersChecksQueue: AnyComputed[] = [];
let gScheduledSubscribersCheckTimeout: ReturnType<typeof setTimeout> | null = null;

export const glob: GlobalVars = {
    gSubscriberContext: null,
    gTransactionDepth: 0,
};

export const gConfig: GlobalConfig = {
    reactionScheduler: DEFAULT_REACTION_RUNNER,
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
        console.error(
            `Possible infinite reaction loop: did not converge after ${gConfig.maxReactionIterations} iterations`
        );
    }

    gScheduledReactions = [];
    gScheduledReactionsIndex = 0;
}

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

export function scheduleStateActualization(computed: AnyComputed) {
    gScheduledStateActualizations.push(computed);
}

function runScheduledStateActualizations() {
    for (let computed; (computed = gScheduledStateActualizations.pop()); ) {
        computed._actualizeAndRecompute();
    }
}

function shouldRunReactionLoop() {
    return gScheduledReactions.length > 0 || gScheduledStateActualizations.length > 0;
}

let isReactionRunnerScheduled = false;

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
        reactionIterationsLeft = gConfig.maxReactionIterations;
        gConfig.reactionScheduler(reactionRunner);
    }
}
