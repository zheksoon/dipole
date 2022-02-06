import { glob, scheduleStateActualization, scheduleReaction } from "../globals";
import { states } from "../constants";
import { endTransaction } from "../transaction";

function getReactionOptions(options) {
    const defaultOptions = {
        autocommitSubscriptions: true,
    };

    if (options && typeof options === "object") {
        if (options.autocommitSubscriptions != null) {
            defaultOptions.autocommitSubscriptions = !!options.autocommitSubscriptions;
        }
    }

    return defaultOptions;
}

export class Reaction {
    constructor(reaction, context, manager, options) {
        this._reaction = reaction;
        this._context = context || null;
        this._manager = manager;
        this._state = states.DIRTY;
        this._subscriptions = [];
        this._children = null;
        this._options = getReactionOptions(options);

        const { gSubscriberContext } = glob;
        if (gSubscriberContext !== null && gSubscriberContext instanceof Reaction) {
            gSubscriberContext._addChild(this);
        }
    }

    _addChild(child) {
        (this._children || (this._children = [])).push(child);
    }

    _destroyChildren() {
        if (this._children !== null) {
            this._children.forEach((child) => child._destroyByParent());
            this._children = null;
        }
    }

    _destroyByParent() {
        this._destroyChildren();
        this._removeSubscriptions();
        this._state = states.DESTROYED_BY_PARENT;
    }

    _notify(state, notifier) {
        if (this._state >= state) {
            return;
        }

        if (state === states.MAYBE_DIRTY) {
            scheduleStateActualization(notifier);
        } else if (state === states.DIRTY) {
            this._state = state;
            scheduleReaction(this);
            this._destroyChildren();
        }
    }

    _subscribeTo(subscription) {
        this._subscriptions.push(subscription);
    }

    _removeSubscriptions() {
        this._subscriptions.forEach((subscription) => {
            subscription._removeSubscriber(this);
        });

        this._subscriptions = [];
    }

    runManager() {
        if (this._manager) {
            this._removeSubscriptions();
            return this._manager();
        } else {
            return this.run();
        }
    }

    run() {
        this._destroyChildren();
        this._removeSubscriptions();

        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = this;

        ++glob.gTransactionDepth;

        try {
            this._state = states.CLEAN;
            return this._reaction.apply(this._context, arguments);
        } finally {
            glob.gSubscriberContext = oldSubscriberContext;
            // if we are about to end all transactions, run the rest of reactions inside it
            if (glob.gTransactionDepth === 1) {
                endTransaction();
            }
            --glob.gTransactionDepth;
        }
    }

    destroy() {
        this._destroyChildren();
        this._removeSubscriptions();
        this._state = states.DIRTY;
    }

    commitSubscriptions() {
        if (!this._options.autocommitSubscriptions) {
            this._subscriptions.forEach((subscription) => {
                subscription._subscribers.add(this);
            });
        }
    }

    setOptions(options) {
        this._options = getReactionOptions(options);
    }
}

export function reaction(reactor, context, manager, options) {
    return new Reaction(reactor, context, manager, options);
}
