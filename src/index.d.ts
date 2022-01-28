declare module "dipole" {
    interface IConfig {
        reactionScheduler?: (runner: () => void) => void;
        subscribersCheckInterval?: number;
    }

    export function configure(config: IConfig): void;

    export interface IObservableOptions<T> {
        checkValue?: (prevValue: T, nextValue: T) => boolean;
    }

    export interface IComputedOptions<T> {
        checkValue?: (prevValue: T, nextValue: T) => boolean;
        keepAlive?: boolean;
    }

    export interface IGettable<T> {
        get(): T;
    }

    export class Observable<T> implements IGettable<T> {
        constructor(value: T, options?: IObservableOptions<T>);
        get(): T;
        set(value: T): void;
        notify(): void;
    }

    export class Computed<T> implements IGettable<T> {
        constructor(computer: () => T, options?: IComputedOptions<T>);
        get(): T;
        destroy(): void;
    }

    export class Reaction<Ctx, Params extends any[], Result> {
        constructor(
            reaction: (this: Ctx, ...params: Params) => Result,
            context?: Ctx,
            manager?: (this: Reaction<Ctx, Params, Result>) => any
        );
        runManager(): any;
        run(...params: Params): Result;
        destroy(): void;
    }

    export function observable<T>(value: T, options?: IObservableOptions<T>): Observable<T>;
    namespace observable {
        export function prop<T>(value: T, options?: IObservableOptions<T>): T;
    }

    export function computed<T>(computer: () => T, options?: IComputedOptions<T>): Computed<T>;
    namespace computed {
        export function prop<T>(computer: () => T, options?: IComputedOptions<T>): T;
    }

    export function reaction<Ctx, Params extends any[], Result>(
        reaction: (this: Ctx, ...params: Params) => Result,
        context?: Ctx,
        manager?: (this: Reaction<Ctx, Params, Result>) => any
    ): Reaction<Ctx, Params, Result>;

    export function action<T extends any[], U>(fn: (...args: T) => U): (...args: T) => U;

    export function tx(thunk: () => unknown): void;

    export function utx<T>(fn: () => T): T;

    export function fromGetter(
        gettersThunk: () => unknown
    ): Observable<unknown> | Computed<unknown> | undefined;

    export function notify(gettersThunk: () => unknown): void;

    export function makeObservable<T extends object>(obj: T): T;

    export function asProp<T>(value: Observable<T> | Computed<T>): T;

    type ObservableProps<T extends object> = {
        [K in keyof T]?: Observable<T[K]> | Computed<T[K]>;
    };

    export function makeObservableProto<T extends object>(
        obj: T,
        targetClass: new (...args: any) => T,
        observables: ObservableProps<T>
    ): void;

    export function when(condition: () => boolean, body: () => unknown): Reaction<null, [], void>;

    export function once(condition: () => boolean, body: () => unknown): Reaction<null, [], void>;
}
