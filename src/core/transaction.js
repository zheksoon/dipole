import {
    glob,
    runScheduledStateActualizations,
    runScheduledReactions,
    hasScheduledStateActualizations,
    hasScheduledReactions,
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
    const oldComputedContext = glob.gComputedContext;
    glob.gComputedContext = null;

    ++glob.gTransactionDepth;
    try {
        return fn();
    } finally {
        if (--glob.gTransactionDepth === 0) {
            endTransaction();
        }
        glob.gComputedContext = oldComputedContext;
    }
}

export function untracked(fn) {
    const oldComputedContext = glob.gComputedContext;
    glob.gComputedContext = null;
    try {
        return fn();
    } finally {
        glob.gComputedContext = oldComputedContext;
    }
}

export function action(fn) {
    // Do not DRY with `utx()` because of extra work for applying `this` and `arguments` to `fn`
    return function () {
        // actions should not introduce new dependencies when obsesrvables are observed
        const oldComputedContext = glob.gComputedContext;
        glob.gComputedContext = null;

        ++glob.gTransactionDepth;
        try {
            return fn.apply(this, arguments);
        } finally {
            if (--glob.gTransactionDepth === 0) {
                endTransaction();
            }
            glob.gComputedContext = oldComputedContext;
        }
    };
}

export function endTransaction() {
    while (hasScheduledStateActualizations() || hasScheduledReactions()) {
        runScheduledStateActualizations();
        runScheduledReactions();
    }
}
