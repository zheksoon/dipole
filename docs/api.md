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
}

new Computed<T>(computer: () => T, options?: IComputedOptions<T>)
computed<T>(computer: () => T, options?: IComputedOptions<T>)
```
Create a `Computed` instance with `computer` function used for computed value calculations. `computer` must be a pure function and not change/notify any observable - only `.get()` calls to other `Observable`/`Computed` values are prohibited. 

`options` object may optionally contain `checkValue` function, which enables complex logic that stops dependant reactions or computed values from running if the value of the computed hasn't changed.

### .get()
```ts
Computed.prototype.get()
```
Get result of `computer` function invocation. The result is computed at the moment of invocation, if it's the first time the method is called or some of computed dependencies are changed. Otherwise, cached value is returned. Also it tracks the usage of the computed into underlying `Computed` or `Reaction`

## Reaction

### constructor
```ts
new Reaction(reactor [, context [, manager]])
reaction(reactor [, context [, manager]])
```
Creates a `Reaction` instance with `reactor` function in its core, with optional `context` and `manager` arguments. `context` is `this` argument for `reactor` param, defaults to `undefined`. `manager` is a function that should somehow schedule/manage invocation of `.run()` method of the object on reaction's dependency change. See [dipole-react](https://github.com/zheksoon/dipole-react) bindings for example of `manager` usage. 

### .run(...args)
```ts
Reaction.prototype.run(...arguments)
```
Runs reaction's `reactor` function with `this` set to `context` and passes all method's arguments to it. Reaction body runs in implicit transaction, so there is no need to use transactions inside it.

### .destroy()
```ts
Reaction.prototype.destroy()
```
Destroys reaction, so it doesn't react to any changes anymore before next manual invocation of `.run()` method.

## Actions and transactions

### action(...args)
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
