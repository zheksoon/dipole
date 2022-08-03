import { State } from "./constants";

export type SubscriberState = State.MAYBE_DIRTY | State.DIRTY;

export interface IObservableOptions<T> {
    checkValue?: (prevValue: T, nextValue: T) => boolean;
}

export interface IComputedOptions<T> {
    checkValue?: (prevValue: T, nextValue: T) => boolean;
    keepAlive?: boolean;
}

export interface IReactionOptions {
    autocommitSubscriptions?: boolean;
}

export interface IGettable<T> {
    get(): T;
}

export interface IObservable<T> extends IGettable<T> {
    set(value: T): void;

    notify(): void;
}

export interface IComputed<T> extends IGettable<T> {
    destroy(): void;
}

export interface IReaction<_This, Params extends any[], Result> {
    runManager(): any;

    run(...params: Params): Result;

    destroy(): void;
}

export interface IObservableImpl<T> extends IObservable<T> {
    _addSubscriber(subscriber: AnySubscriber): void;
}

export interface IComputedImpl<T> extends IComputed<T> {
    _actualizeAndRecompute(): void;

    _notify(state: SubscriberState, notifier: AnySubscription): void;

    _addSubscriber(subscriber: AnySubscriber): void;

    _getRef(): WeakRef<IComputedImpl<T>>;
}

export interface IReactionImpl<This, Params extends any[], Result>
    extends IReaction<This, Params, Result> {
    _addChild(child: IReactionImpl<any, any, any>): void;

    _destroyChildren(): void;

    _destroyByParent(): void;

    _notify(state: SubscriberState, notifier: AnySubscription): void;

    _shouldRun(): boolean;

    _getRef(): WeakRef<IReactionImpl<This, Params, Result>>;
}

export type AnyObservable = IObservableImpl<any>;

export type AnyComputed = IComputedImpl<any>;

export type AnyReaction = IReactionImpl<any, any, any>;

export type AnySubscriber = AnyComputed | AnyReaction;

export type AnySubscription = AnyObservable | AnyComputed;

export type AnySubscriberRef = WeakRef<AnySubscriber>;
