import { glob } from "../globals/variables";
import { scheduleReaction, endTransaction } from "../schedulers/reaction";
import { scheduleStateActualization } from "../schedulers/stateActualization";
import { State } from "../constants";
import {
    AnyComputed,
    AnyReaction,
    AnySubscription,
    IReactionImpl,
    IReactionOptions,
    SubscriberState,
} from "../types";

type Options = {
    autocommitSubscriptions: boolean;
};

type ReactionState = typeof State.CLEAN | typeof State.DIRTY | typeof State.DESTROYED_BY_PARENT;

function getReactionOptions(options?: IReactionOptions): Options {
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

export class Reaction<Ctx, Params extends any[], Result>
    implements IReactionImpl<Ctx, Params, Result>
{
    private _reaction: (this: Ctx, ...args: Params) => Result;
    private _context: Ctx | null;
    private _manager: (() => void) | undefined;
    private _state: ReactionState;
    private _subscriptions: AnySubscription[];
    private _children: null | AnyReaction[];
    private _options: Options;

    constructor(
        reaction: (this: Ctx, ...args: Params) => Result,
        context?: Ctx,
        manager?: () => void,
        options?: IReactionOptions
    ) {
        this._reaction = reaction;
        this._context = context || null;
        this._manager = manager;
        this._state = State.DIRTY;
        this._subscriptions = [];
        this._children = null;
        this._options = getReactionOptions(options);

        const { gSubscriberContext } = glob;
        if (gSubscriberContext !== null && gSubscriberContext instanceof Reaction) {
            gSubscriberContext._addChild(this);
        }
    }

    _addChild(child: AnyReaction): void {
        (this._children || (this._children = [])).push(child);
    }

    _destroyChildren(): void {
        if (this._children !== null) {
            this._children.forEach((child) => child._destroyByParent());
            this._children = null;
        }
    }

    _destroyByParent(): void {
        this._destroyChildren();
        this._removeSubscriptions();
        this._state = State.DESTROYED_BY_PARENT;
    }

    _notify(state: SubscriberState, notifier: AnySubscription): void {
        if (this._state >= state) {
            return;
        }

        if (state === State.MAYBE_DIRTY) {
            scheduleStateActualization(notifier as AnyComputed);
        } else if (state === State.DIRTY) {
            this._state = state;
            scheduleReaction(this);
            this._destroyChildren();
        }
    }

    _subscribeTo(subscription: AnySubscription): void {
        if (!this._options.autocommitSubscriptions || subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _removeSubscriptions(): void {
        this._subscriptions.forEach((subscription) => {
            subscription._removeSubscriber(this);
        });

        this._subscriptions = [];
    }

    _shouldRun(): boolean {
        return this._state === State.DIRTY;
    }

    runManager(): void {
        if (this._manager) {
            this._removeSubscriptions();
            this._manager();
        } else {
            this.run();
        }
    }

    run(): Result {
        this._destroyChildren();
        this._removeSubscriptions();

        const oldSubscriberContext = glob.gSubscriberContext;
        glob.gSubscriberContext = this;

        ++glob.gTransactionDepth;

        try {
            this._state = State.CLEAN;
            return this._reaction.apply(this._context!, arguments as unknown as Params);
        } finally {
            glob.gSubscriberContext = oldSubscriberContext;
            
            if (--glob.gTransactionDepth === 0) {
                endTransaction();
            };
        }
    }

    destroy(): void {
        this._destroyChildren();
        this._removeSubscriptions();
        this._state = State.DIRTY;
    }

    commitSubscriptions(): void {
        if (!this._options.autocommitSubscriptions) {
            this._subscriptions.forEach((subscription) => {
                subscription._addSubscriber(this);
            });
        }
    }

    setOptions(options: IReactionOptions): void {
        this._options = getReactionOptions(options);
    }
}

export function reaction<Ctx, Params extends any[], Result>(
    reactor: (this: Ctx, ...args: Params) => Result,
    context?: Ctx,
    manager?: () => void,
    options?: IReactionOptions
) {
    return new Reaction(reactor, context, manager, options);
}
