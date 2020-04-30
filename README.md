# Dipole - tiny reactive state management that just works

Dipole is tiny (just over 1K min gz) reactive state management library that could be used standalone or with React/Preact. It's heavily inspired by [MobX](https://github.com/mobxjs/mobx) and was initially thought as a pedagogical re-implementation of its core features, and had grown later to a complete library. At this moment dipole can be seen as MobX minus "magic".
  

**Dipole features**:

 * Clean and minimalistic object-oriented implementation of observable/functional reactive paradigm in about 300 lines of code  
 * ES3 compatibility - should work even in a very old browsers  
 * Tiny core - just three classes and two functions  
 * Opaque data structures - you can easily examine dipole internals in debugger, no class fields is mangled  
 * Performance optimizations - even with a huge amount of observable/computed values dipole runs as efficiently as possible  
 * Good test suit

## Introduction  

Dipole core consists three main classes: `Observable`, `Computed` and `Reaction`. All the classes can be constructed via non-capitalized factory functions `observable`, `computed` and `reaction` correspondingly without `new` keyword.  

### Observable  

Observables are containers that contain some value and allow some other dependent objects to get notified when the value changes.  

```javascript  
import { observable } from 'dipole'  
  
const counter = observable(0)  
counter.get()   // returns 0  
counter.set(1)  // sets observable value to 1  
```  

### Computed  

Computed values are values that are derived from other observables and computeds with some pure function. The function should not contain any side-effects other than returning a value and depend only on observable/computed values. The result of computed is cached until any of its dependencies are changed.  

```javascript  
import { computed } from 'dipole'  
  
const double = computed(() => {  
    console.log('Computing double value...')  
    return counter.get() * 2  
})  
double.get()    // prints 'Computing double value...' and returns 2  
double.get()    // doesn't print and returns 2 - the result is cached!  
  
counter.set(2)  // update computed dependency  
double.get()    // prints 'Computing double value...' and returns 4  
  
// another way to invalidate an observable is to call `.notify()`  
// this is useful when observable contains a complex object like Array or Map  
counter.notify()  
double.get()    // prints 'Computing double value...' and returns 4 again  
```  

Of course computed values can contain any kind of conditions/loops that dynamically reference to different observables, this will be correctly handled by dipole:  

```javascript  
const cond = observable(true)  
const a = observable('a')  
const b = observable('b')  
  
const result = computed(() => {  
    console.log('Computing result...')  
    return cond.get() ? a.get() : b.get()  
})  
result.get()    // prints 'Computing result' and returns 'a'  
        // now `result` depends on `cond` and `a` values  
cond.set(false)  
result.get()    // prints 'Computing result' and returns 'b'  
        // now `result` depends on `cond` and `b` values  
  
a.set('aa') // `result` doesn't depend on `a`, nothing will happen  
result.get()    // nothing changed for `result`, just returns 'b' again  
  
b.set('bb') // change `result` dependency  
result.get()    // prints 'Computing result' and returns 'bb'  
```  

There are some intuitive limitations for computed values:  

1) They can't recursively refer to itself:  

```javascript  
const recur = computed(() => recur.get() + 1)  
recur.get() // throws 'Trying to get computed value while in computing state'  
```  

2) They must not change any observable or trigger any side-effects:  

```javascript  
const badBoy = computed(() => counter.set(0))  
badBoy.get()    // throws `Can't change observable value inside of computed`  
```  

### Reaction and transaction  

Reactions are automatic actions that are triggered on dependent observable/computed changes  

```javascript  
const a = observable(1)  
const b = observable(2)  
const sum = computed(() => a.get() + b.get())  
const r = reaction(() => {  
    console.log(`Sum of ${a.get()} and ${b.get()} is ${sum.get()}`)  
})  
r.run()     // first run should be triggered manually  
        // prints 'Sum of 1 and 2 is 3'  
  
a.set(3)    // prints 'Sum of 3 and 2 is 5'  
b.set(4)    // prints 'Sum of 3 and 4 is 7'  
```  

Last lines show that reaction reacts to **each** change in its dependencies, synchronously. But what if we want to batch changes and run reaction only once after both `a` and `b` changes?for  
Here's the answer: **transaction**:  

```javascript  
import { transaction } from 'dipole'  
  
transaction(() => {  
    a.set(2)    // doesn't react  
    b.set(3)    // doesn't react too  
})      // prints 'Sum 2 and 3 is 5' right after transaction end  
```  

**Actions** are functions wrapped in transaction:  

```javascript  
import { action } from 'dipole'  
  
const addBoth = action(amount => {  
    a.set(a.get() + amount)  
    b.set(b.get() + amount)  
})  
  
// invoke action, all arguments are passed to inner function  
addBoth(3)  // prints 'Sum of 5 and 6 is 11' once  
```  

Reactions could be destroyed, so they will not run after that:  

```javascript  
r.destroy()  
a.set(4)    // doesn't react to the change anymore  
```  

Advanced reaction usage with reaction context and manager argument:  

```javascript  
const delayed = reaction(  
    () => console.log(counter.get()),   // reaction body  
    null,                   // reaction context (`this` for reaction body)  
    () => setTimeout(timedOut.run(), 1000)  // reaction manager, should manage to run `.run()` method somehow  
)  
delayed.run()   // prints '3'  
counter.set(4)  // prints '4' after 1 second  
```  

Limitation: please avoid changing reaction's dependencies inside reaction body - this will cause reaction running in an infinite loop:  

```javascript  
const forever = reaction(() => counter.set(counter.get() + 1))  
forever.run()   // never ends  
```  

## Usage with React/Preact  

With [dipole-react](https://github.com/zheksoon/dipole-react) or [dipole-preact](https://github.com/zheksoon/dipole-preact) connectors dipole could be used as a state management solution for React/Preact applicaiton.  
  

Here's example of a simple counter app:  

```javascript  
import { observable, computed, action } from 'dipole'  
import { observer } from 'dipole-react'  
  
let counterId = 0  
class CounterModel {  
    id = counterId++  
    count = observable(0)  
    inc = action(() => this.count.set(this.count.get() + 1))  
    dec = action(() => this.count.set(this.count.get() - 1))  
    reset = action(() => this.count.set(0))  
}  
  
const Counter = observer(({ model }) => {  
    return (  
        <>  
            Counter: {model.count.get()}  
            <button onClick={model.inc}>+</button>  
            <button onClick={model.dec}>-</button>  
            <button onClick={model.reset}>reset</button>  
        </>  
    )  
})  
  
const counter = new CounterModel()  
render(<Counter model={counter} />, root)  
```  

You just need to wrap your component into `observer` function to make it re-render on its dependency changes.  
  

Here's how counters could be easily composed into a counter list app:  

```javascript  
class CounterListModel {  
    counters = observable([])  
    totalCounters = computed(() => {  
        return this.counters.get().length  
    })  
    totalCountersSum = computed(() => {  
        return this.counters.get().reduce((acc, counter) => {  
            return acc + counter.count.get()  
        }, 0)  
    })  
    addCounter = action(() => {  
        const counter = new CounterModel()  
        this.counters.get().push(counter)  
        this.counters.notify()  
    })  
    removeCounter = action((id) => {  
        const filtered = this.counters.get().filter(counter => counter.id !== id)  
        this.counters.set(filtered)  
    })  
    resetAll = action(() => {  
        this.counters.get().forEach(counter => counter.reset())    
    })  
}  
  
const CounterListCount = observer(({ model }) => {  
    return `Total counters: ${model.totalCounters.get()}`  
})  
  
const CounterListSum = observer(({ model }) => {  
    return `Total sum: ${model.totalCountersSum.get()}`  
})  
  
const CounterList = observer(({ model }) => {  
    return (  
        <div>  
            <CounterListCount model={model} />  
            <br/>  
            <CounterListSum model={model} />  
            <br/>  
            <button onClick={model.addCounter}>Add</button>  
            <button onClick={model.resetAll}>Reset all</button>  
            {model.counters.get().map((counter) => (  
                <div key={counter.id}>  
                    <Counter model={counter} />  
                    <button onClick={() => model.removeCounter(counter.id)}>  
                 Remove  
                </button>  
                </div>  
            ))}  
        </div>  
    )  
})  
  
const counterList = new CounterListModel()  
render(<CounterList model={counterList} />, root)  
```  

Note how the `.notify()` method is used in `addCounter` action - we have modified underlying counters array and by calling `.notify()` on the corresponding observable we let it know about the change.  
Also note that `CounterListCount` and `CounterListSum` are separated into a separate observer components,  so when corresponding computed value changes, only the components get re-rendered instead of full counter list.  

## API  

### Observable  
```javascript  
new Observable(value)  
observable(value)  
```  
Creates an `Observable` instance containing the `value`  

```javascript  
Observable.prototype.get()  
```  
Get the value from `Observable` instance and track the usage of the observable into underlying `Computed` or `Reaction`  

```javascript  
Observable.prototype.peek()  
```  
Get a value from `Observable` instance without tracking by underlying `Computed`/`Reaction`  

```javascript  
Observable.prototype.set(value)  
```  
Sets a new value of `Observable`, notifying dependent `Computed`/`Reaction` about the change  

```javascript  
Observable.prototype.notify()  
```  
Notify dependent `Computed`/`Reaction` about a change in underlying `Observable`'s value. Useful after changing mutable objects like Arrays, Maps or any other objects.  
  

### Computed  
```javascript  
new Computed(computer)  
computed(computer)  
```  

Create a `Computed` instance with `computer` function used for computed value calculations. `computer` must be a pure function and not change/notify any observable - only `.get()` calls to other `Observable`/`Computed` values are prohibited.  

```javascript  
Computed.prototype.get()  
```  

Get result of `computer` function invocation. The result is computed at the moment of invocation, if it's the first time the method is called or some of computed dependencies are changed. Otherwise, cached value is returned. Also it tracks the usage of the computed into underlying `Computed` or `Reaction`  

```javascript  
Computed.prototype.peek()  
```   

the same as `.get()` but without tracking the usage into underlying `Computed`/`Reaction`.  

### Reaction  

```javascript  
new Reaction(reactor [, context [, manager]])  
reaction(reactor [, context [, manager]])  
```  

Creates a `Reaction` instance with `reactor` function in its core, with optional `context` and `manager` arguments. `manager` is a function that should somehow schedule/manage invocation of `.run()` method of the object on reaction's dependency change.  

```javascript  
Reaction.prototype.run(...arguments)  
```  

Runs reaction's `reactor` function with `this` set to `context` and passes all method's arguments to it.  

```javascript  
Reaction.prototype.destroy()  
```  

Destroys reaction, so it doesn't react to any changes anymore before another manual invocation of `.run()` method.
```javascript
Observable.prototype.set(value)
```
Sets a new value of `Observable`, notifying dependent `Computed`/`Reaction` about the change
```javascript
Observable.prototype.notify()
```
Notify dependent `Computed`/`Reaction` about a change in underlying `Observable`'s value. Useful after changing mutable objects like Arrays, Maps or any other objects.

### Computed
```javascript
new Computed(computer)
computed(computer)
```
Create a `Computed` instance with `computer` function used for computed value calculations. `computer` must be a pure function and not change/notify any observable - only `.get()` calls to other `Observable`/`Computed` values are prohibited.
```javascript
Computed.prototype.get()
```
Get result of `computer` function invocation. The result is computed at the moment of invocation, if it's the first time the method is called or some of computed dependencies are changed. Otherwise, cached value is returned. Also it tracks the usage of the computed into underlying `Computed` or `Reaction`
```javascript
Computed.prototype.peek()
``` 
the same as `.get()` but without tracking the usage into underlying `Computed`/`Reaction`.

### Reaction
```javascript
new Reaction(reactor [, context [, manager]])
reaction(reactor [, context [, manager]])
```
Creates a `Reaction` instance with `reactor` function in its core, with optional `context` and `manager` arguments. `manager` is a function that should somehow schedule/manage invocation of `.run()` method of the object on reaction's dependency change.
```javascript
Reaction.prototype.run(...arguments)
```
Runs reaction's `reactor` function with `this` set to `context` and passes all method's arguments to it.
```javascript
Reaction.prototype.destroy()
```
Destroys reaction, so it doesn't react to any changes anymore before another manual invocation of `.run()` method.

### transaction
```javascript
transaction(thunk)
```
Execute `thunk` function in transaction block. The `thunk` function is invoked without arguments or `this`

### action
```javascript
action(fn)
```
Returns a function wrapped in transaction. Calls to the resulting function pass all arguments to `fn`, `this` argument is also inherited from resulting function. `.get()` calls to any observables/computed values won't introduce new dependencies when called inside action body (but it's not true for transaction).

## Author
Eugene Daragan

## License
MIT
