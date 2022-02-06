import {
    glob,
    runScheduledStateActualizations,
    runScheduledReactions,
    hasScheduledStateActualizations,
    hasScheduledReactions,
    gConfig,
} from "./globals";

// Transaction (TX)
export function tx(thunk) {
    ++glob.gTransactionDepth;
    try {
        thunk();
    } finally {
        if (--glob.gTransactionDepth === 0) {
            endTransaction();
        }
    }
}

// Untracked Transaction (UTX)
export function utx(fn) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = null;

    ++glob.gTransactionDepth;
    try {
        return fn();
    } finally {
        if (--glob.gTransactionDepth === 0) {
            endTransaction();
        }
        glob.gSubscriberContext = oldSubscriberContext;
    }
}

export function untracked(fn) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = null;
    try {
        return fn();
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
    }
}

export function action(fn) {
    // Do not DRY with `utx()` because of extra work for applying `this` and `arguments` to `fn`
    return function () {
        // actions should not introduce new dependencies when obsesrvables are observed
        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = null;

        ++glob.gTransactionDepth;
        try {
            return fn.apply(this, arguments);
        } finally {
            if (--glob.gTransactionDepth === 0) {
                endTransaction();
            }
            glob.gSubscriberContext = oldSubscriberContext;
        }
    };
}

let isReactionRunnerScheduled = false;

function shouldRunReactionLoop() {
    return hasScheduledReactions() || hasScheduledStateActualizations();
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
