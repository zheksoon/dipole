import { glob, scheduleStateActualization, scheduleReaction } from "../globals";
import { states } from "../constants";
import { endTransaction } from "../transaction";
import { removeSubscriptions, actualizeState } from "./common";

export class Reaction {
    constructor(reaction, context, manager) {
        this._reaction = reaction;
        this._context = context || null;
        this._manager = manager;
        this._state = states.DIRTY;
        this._subscriptions = [];
        this._children = [];

        const { gComputedContext } = glob;
        if (gComputedContext !== null && gComputedContext instanceof Reaction) {
            gComputedContext._addChild(this);
        }
    }

    _addChild(child) {
        this._children.push(child);
    }

    _destroyChildren() {
        if (this._children.length > 0) {
            this._children.forEach((child) => child._destroyByParent());
            this._children = [];
        }
    }

    _destroyByParent() {
        this._destroyChildren();
        removeSubscriptions(this);
        this._state = states.DESTROYED_BY_PARENT;
    }

    _notify(state) {
        if (this._state < state) {
            this._state = state;

            if (state === states.MAYBE_DIRTY) {
                scheduleStateActualization(this);
            }

            if (state === states.DIRTY) {
                scheduleReaction(this);
                this._destroyChildren();
            }
        }
    }

    _subscribeTo(subscription) {
        this._subscriptions.push(subscription);
    }

    _actualizeState() {
        if (this._state === states.MAYBE_DIRTY) {
            actualizeState(this);
        }
    }

    runManager() {
        if (this._manager) {
            removeSubscriptions(this);
            return this._manager();
        } else {
            return this.run();
        }
    }

    run() {
        this._destroyChildren();
        removeSubscriptions(this);

        const oldComputedContext = glob.gComputedContext;
        glob.gComputedContext = this;

        ++glob.gTransactionDepth;

        try {
            this._state = states.CLEAN;
            return this._reaction.apply(this._context, arguments);
        } finally {
            glob.gComputedContext = oldComputedContext;
            // if we are about to end all transactions, run the rest of reactions inside it
            if (glob.gTransactionDepth === 1) {
                endTransaction();
            }
            --glob.gTransactionDepth;
        }
    }

    destroy() {
        this._destroyChildren();
        removeSubscriptions(this);
        this._state = states.DIRTY;
    }
}

export function reaction(reactor, context, manager) {
    return new Reaction(reactor, context, manager);
}