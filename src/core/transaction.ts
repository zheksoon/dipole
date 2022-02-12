import { glob, endTransaction } from "./globals";

// Transaction (TX)
export function tx(thunk: () => any): void {
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
export function utx<T>(fn: () => T): T {
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

export function untracked<T>(fn: () => T): T {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = null;
    try {
        return fn();
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
    }
}

export function action<Args extends any[], Result, This>(
    fn: (this: This, ...args: Args) => Result
): (this: This, ...args: Args) => Result {
    // Do not DRY with `utx()` because of extra work for applying `this` and `arguments` to `fn`
    return function () {
        // actions should not introduce new dependencies when obsesrvables are observed
        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = null;

        ++glob.gTransactionDepth;
        try {
            return fn.apply(this, arguments as unknown as Args);
        } finally {
            if (--glob.gTransactionDepth === 0) {
                endTransaction();
            }
            glob.gSubscriberContext = oldSubscriberContext;
        }
    };
}
