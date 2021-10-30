import { SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL, states } from "./constants";

let gScheduledReactions = [];
let gScheduledStateActualizations = [];
let gScheduledSubscribersChecks = new Set();
let gScheduledSubscribersCheckTimeout = null;

export const glob = {
    gComputedContext: null,
    gTransactionDepth: 0,
};

// Work queues functions

export function scheduleReaction(reaction) {
    gScheduledReactions.push(reaction);
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
    gScheduledSubscribersChecks.add(computed);
    if (!gScheduledSubscribersCheckTimeout) {
        gScheduledSubscribersCheckTimeout = setTimeout(
            runScheduledSubscribersChecks,
            SCHEDULED_SUBSCRIBERS_CHECK_INTERVAL
        );
    }
}

export function runScheduledSubscribersChecks() {
    gScheduledSubscribersChecks.forEach((computed) => {
        // delete computed first because it might be reintroduced
        // into the set later in the iteration by `_checkSubscribers` call
        // it's safe to delete and add items into Set while iterating
        gScheduledSubscribersChecks.delete(computed);
        computed._checkSubscribers();
    });
}

export function scheduleStateActualization(computed) {
    gScheduledStateActualizations.push(computed);
}

export function runScheduledStateActualizations() {
    let reaction;
    while ((reaction = gScheduledStateActualizations.pop())) {
        reaction._actualizeState();
    }
}
