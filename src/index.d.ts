declare module "dipole" {
    export interface IGettable<T> {
        get(): T;
    }

    export class Observable<T> implements IGettable<T> {
        constructor(value: T);
        get(): T;
        set(value: T): void;
        notify(): void;
    }

    export class Computed<T> implements IGettable<T> {
        constructor(computer: () => T);
        get(): T;
        destroy(): void;
    }

    export class Reaction<Ctx, Params extends any[], Result> {
        constructor(
            reaction: (this: Ctx, ...params: Params) => Result,
            context?: Ctx,
            manager?: (this: Reaction<Ctx, Params, Result>) => any
        )
        runManager(): any;
        run(...params: Params): Result;
        destroy(): void;
    }

    export function observable<T>(value: T): Observable<T>;
    namespace observable {
        export function prop<T>(value: T): T;
    }

    export function computed<T>(computer: () => T): Computed<T>;
    namespace computed {
        export function prop<T>(computer: () => T): T;
    }

    export function reaction<Ctx, Params extends any[], Result>(
        reaction: (this: Ctx, ...params: Params) => Result,
        context?: Ctx,
        manager?: (this: Reaction<Ctx, Params, Result>) => any
    ): Reaction<Ctx, Params, Result>;
    
    export function action<T extends any[], U>(
        fn: (...args: T) => U
    ): (...args: T) => U;

    export function tx(thunk: () => unknown): void;
    
    export function utx<T>(fn: () => T): T;

    export function fromGetter<T>(gettersThunk: () => T): IGettable<T> | undefined;

    export function notify(gettersThunk: () => unknown): void;

    export function makeObservable<T extends object>(obj: T): T; 
}