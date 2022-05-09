---
title: API reference
---
# API reference

## Observable

### constructor
```ts
interface IObservableOptions<T> {
    checkValue?: (prevValue: T, nextValue: T) => boolean;
}

new Observable<T>(value: T, options?: IObservableOptions<T>): Observable<T>
observable<T>(value: T, options?: IObservableOptions<T>): Observable<T>
```
Creates an `Observable` instance containing the `value`. 

`options` object may optionally contain `checkValue` function, which will be invoked on every `set()` call and compare current and new observable values. If the `checkValue` returns `true` (means the values are equal), change signal is not propogated to its subscribers.

### .get()
```ts
Observable.prototype.get()
```
Get the value from `Observable` instance and track the usage of the observable into currently executed `Computed` or `Reaction`

### .set(value)
```ts
Observable.prototype.set(value)
```
Sets a new value of `Observable`, notifying dependent `Computed`/`Reaction` about the change. If the observable instance was created with `checkValue` function, performs the check first and does the subscribers notification only if `checkValue` returned `false`.

### .notify()
```ts
Observable.prototype.notify()
```
Notify dependent `Computed`/`Reaction` about a change in underlying `Observable`'s value. Useful after changing mutable objects like Arrays, Maps or any other objects. `checkValue` option doesn't change the behaviour.

## Computed

### constructor
```ts
interface IComputedOptions<T> {
    checkValue?: (prevValue: T, nextValue: T) => boolean;
    keepAlive?: boolean;
}

new Computed<T>(computer: () => T, options?: IComputedOptions<T>)
computed<T>(computer: () => T, options?: IComputedOptions<T>)
```
Create a `Computed` instance with `computer` function used for computed value calculations. `computer` must be a pure function and not change/notify any observable - only `.get()` calls to other `Observable`/`Computed` values are prohibited. 

`options` object may optionally contain `checkValue` function, which enables complex logic that stops dependant reactions or computed values from running if the value of the computed hasn't changed.

`keepAlive` option prevents the computed value from being destroyed when is looses all subscribers or after being accessed outside of reactive context.

### .get()
```ts
Computed.prototype.get()
```
Get result of `computer` function invocation. The result is computed at the moment of invocation, if it's the first time the method is called or some of computed dependencies are changed. Otherwise, cached value is returned. Also it tracks the usage of the computed into underlying `Computed` or `Reaction`

## Reaction

### constructor
```ts
new Reaction(reactor [, context [, manager, [, options]]])
reaction(reactor [, context [, manager, [, options]]])
```
Creates a `Reaction` instance with `reactor` function in its core, with optional `context` and `manager` arguments. `context` is `this` argument for `reactor` param, defaults to `undefined`. `manager` is a function that should somehow schedule/manage invocation of `.run()` method of the object on reaction's dependency change. See [dipole-react](https://github.com/zheksoon/dipole-react) bindings for example of `manager` usage. 

The `options` argument has following definition: 

```ts
interface IReactionOptions {
    autocommitSubscriptions?: boolean;
}
```

Options description:

* `autocommitSubscriptions?: boolean` (default value - `true`): when `false`, forces `Reaction` instance not to subscribe to observable and computed values automatically, only after manually calling [commitSubscriptions](#commitSubscriptions) method. 

    This option was added to support SSR, Concurrent and Strict Modes in `dipole-react` connector, when rendered component can be thrown away. Without the option it would introduce a memory leak. Please see [dipole-react](https://github.com/zheksoon/dipole-react) source code for more details.

### .run(...args)

Runs reaction's `reactor` function with `this` set to `context` and passes all method's arguments to it. Reaction body runs in implicit transaction, so there is no need to use transactions inside of it.

### .destroy()

Destroys reaction, so it doesn't react to any changes anymore before next manual invocation of `.run()` method.

### .commitSubscriptions()

The method has effect only in case `autocommitSubscriptions` option was set to `false`. 
It make the reaction instance subscribe to all its dependencies that were collected during the last `.run()` call.

### .setOptions(options)

The method allows to set reaction options on the fly. Currently only `autocommitSubscriptions` is supported. It's better not to call the method inside of `.run()`,  so reaction's subscriptions will be consistent.

## Actions and transactions

### action
```ts
action((...args) => { ...action body... })
```
Returns a function wrapped in untracked transaction. Calls to the resulting function will pass all arguments and  `this` to action body.  Since action body is untracked, `.get()` calls or getters to any observables/computed values won't introduce new dependencies when called inside action body (but it's not true for transaction).

### transaction (tx)
```ts
tx(() => { ...transaction body... })
```
Execute transaction body function in transaction block. The body function is invoked without any arguments or `this`. 

### untracked transaction (utx)
```ts
utx(() => { ...transaction body with result... })
```
Execute transaction body in untracked transaction and return execution result. Because transaction is untracked, `.get()` calls or getters to any observables/computed values won't introduce new dependencies when called inside of it.

## Utilities

### makeObservable(object)
```ts
makeObservable(object)
```
Iterates through own enumerable properties and replaces them with getters/setters for each instanse of Observable/Computed classes. Only properties are processed, so if there are already some getters on the object, they won't be invoked. Mutates the object and returns it as result.

### fromGetter(thunk)
```ts
fromGetter(() => { ...some getter call to observable/computed... })
```
Returns an observable/computed object hidden under some getter called in the body function. Returns `undefined` if the function didn't call any getters/`.get()` methods. If there is more than one getter call in the body function, only result for the latest one returned.

### notify(thunk)
```ts
notify(() => { ...some getter calls on observables... })
```
Calls `.notify()` method on all observables, which getters were executed in body function.

## configure

dipole has global `configure` function that allows to tune some internal behaviour.

```ts
interface GlobalConfig {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
    maxReactionIterations: number;
}

export function configure(config: GlobalConfig): void;
```

### reactionScheduler

`reactionScheduler` option allows to customize the way how reaction queue will be runned. The option must be a function that takes one argument (`runner`), and, when called, should somehow run the `runner` function.

Default implementation is equivalent to the following:

```ts
configure({
    reactionScheduler: (runner) => runner(),
})
```

e.g. runs the `runner` immediately.

For some practical use cases (especially when asyncronous operations are used) microtask runner could be useful:

```ts
configure({
    reactionScheduler: (runner) => Promise.resolve().then(runner),
})
```

This will allow to skip wrapping observable state changes inside async flow in `utx` functions, allowing cleaner code like this:

```ts
class UserModel {
    fetchUsers = action(async () => {
        this.isLoading = true;
        try {
            this.users = await fetch(...).then((res) => res.json());
        } catch (err) {
            this.error = err;
        } finally {
            this.isLoading = false;
        }
    }) 
}
```

#### Global error handling

When some reaction raises an error, reaction execution loop is stopped. In order to continue, you should run the `runner` function again until it exits normally:

```ts
function reactionScheduler(runner: () => void) {
    while (true) {
        try {
            runner();
            break;
        } catch (err) {
            // Global error handler
            console.log(err);
        }
    }
}

configure({ reactionScheduler });
```

### subscribersCheckInterval

`subscribersCheckInterval` option is interval in milliseconds for how often computed values that lost all their subscriptions (or never gained them) will be invalidated. Default value is `1000`.

### maxReactionIterations

`maxReactionIterations` limits number of reaction schedule/exceution loops, preventing dipole from infinite loops in case when a reaction changes some of its dependencies. Must be greater than `0`. Default value is `100`. When the limit is exceeded, a corresponding message will be logged to console.