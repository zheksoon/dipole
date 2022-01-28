import { SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL, states } from "./constants";
import { HashSet } from "./data-structures/hash-set";

let gScheduledReactions = [];
let gScheduledStateActualizations = [];
let gScheduledSubscribersChecks = new HashSet();
let gScheduledSubscribersChecksQueue = [];
let gScheduledSubscribersCheckTimeout = null;

export const glob = {
    gComputedContext: null,
    gTransactionDepth: 0,
};

export const gConfig = {
    reactionScheduler: (runner) => runner(),
    subscribersCheckInterval: SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL,
};

export function configure(config) {
    if (config.reactionScheduler) {
        gConfig.reactionScheduler = config.reactionScheduler;
    }
    if (config.subscribersCheckInterval) {
        gConfig.subscribersCheckInterval = config.subscribersCheckInterval;
    }
}

// Work queues functions

export function scheduleReaction(reaction) {
    gScheduledReactions.push(reaction);
}

export function hasScheduledReactions() {
    return gScheduledReactions.length > 0;
}

export function runScheduledReactions() {
    let reaction;
    while ((reaction = gScheduledReactions.pop())) {
        if (reaction._state === states.DIRTY) {
            reaction.runManager();
        }
    }
}

export function scheduleSubscribersCheck(computed) {
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

export function runScheduledSubscribersChecks() {
    let computed;
    while ((computed = gScheduledSubscribersChecksQueue.pop())) {
        gScheduledSubscribersChecks.remove(computed);
        
        if (computed._subscribers.size() === 0) {
            computed.destroy();
        }
    }
    gScheduledSubscribersCheckTimeout = null;
}

export function scheduleStateActualization(computed) {
    gScheduledStateActualizations.push(computed);
}

export function hasScheduledStateActualizations() {
    return gScheduledStateActualizations.length > 0;
}

export function runScheduledStateActualizations() {
    let computed;
    while ((computed = gScheduledStateActualizations.pop())) {
        computed._actualizeState();
    }
}
