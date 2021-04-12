# Dipole - tiny reactive state management that just works

Dipole is tiny (just over 1K min gz) reactive state management library that could be used standalone or with React/Preact. It's heavily inspired by [MobX](https://github.com/mobxjs/mobx) and was initially thought as a pedagogical re-implementation of its core features, and had grown later to a complete library. At this moment dipole can be seen as MobX minus "magic".
  

**Dipole features**:

 * Clean and minimalistic object-oriented implementation of observable/functional reactive paradigm in about 300 lines of code
 * Tiny core - just 3 classes and 3 functions
 * Opaque data structures - you can easily examine dipole internals in debugger, no class fields is mangled  
 * Performance optimizations - even with a huge amount of observable/computed values dipole runs as efficiently as possible
 * Good test suit

## Introduction  

Dipole core consists three main classes: `Observable`, `Computed` and `Reaction`. All the classes can be constructed via non-capitalized factory functions `observable`, `computed` and `reaction` correspondingly without `new` keyword.

# Usage with React bindings

## Example 0: Counter. Basics of observables and actions

[Open in Codesandbox](https://codesandbox.io/s/dipole-react-example-counter-o4w64)

```jsx
import { action, observable, makeObservable } from "dipole";
import { reactive } from "dipole-react";

let counterId = 0;

class CounterModel {
  // not observable field
  id = counterId++;
  // observable field
  count = observable.prop(0);

  constructor() {
    // creates getters and setters for observable fields for transparency
    makeObservable(this);
  }

  // actions are atomic changes on observables, see introduction below
  inc = action(() => (this.count += 1));  
  dec = action(() => (this.count -= 1));
  reset = action(() => (this.count = 0));
}

// React component wrapped into `observer` re-renders on observable changes
const Counter = observer(({ model, onRemove }) => {
  return (
    <div>
      Counter is: {model.count}
      <button onClick={model.inc}>+</button>
      <button onClick={model.dec}>-</button>
      <button onClick={model.reset}>Reset</button>
      {onRemove && <button onClick={() => onRemove(model.id)}>Remove</button>}
    </div>
  );
});

const counterModel = new CounterModel();

ReactDOM.render(<Counter model={counterModel} />, document.getElementById("root"));
```

## Example 1: Counter list. Model composition and computed data

Using the counter example above, let's compose multiple Counter models into a more complex app.

[Open in Codesandbox](https://codesandbox.io/s/dipole-react-example-counter-list-u1fvc?file=/src/index.js)

```jsx
import { computed } from "dipole";

class CounterListModel {
  counters = observable.prop([]);

  // computeds are fields with data derived from other computeds/observables
  countersTotal = computed.prop(() => {
    return this.counters.length;
  });

  countersSum = computed.prop(() => {
    return this.counters.reduce((acc, counter) => acc + counter.count, 0);
  });

  constructor() {
    makeObservable(this);
  }

  addCounter = action(() => {
    const counter = new CounterModel();
    this.counters.push(counter);
    // as observables are dump containers for data,
    // we need to let them know about changes in underlying data structures
    this.counters = this.counters; // or notify(() => this.counters)
  });

  removeCounter = action((id) => {
    // no need for notify() because we are doing an assignment here
    this.counters = this.counters.filter((counter) => counter.id !== id);
  });

  // action can aggregate multiple other actions and still be atomic
  resetAll = action(() => {
    this.counters.forEach((counter) => counter.reset());
  });
}

const CounterList = observer(({ model }) => {
  return (
    <div>
      <p>Counters total: {model.countersTotal}</p>
      <p>Counters sum: {model.countersSum}</p>
      {model.counters.map((counter) => (
        <Counter
          key={counter.id}
          model={counter}
          onRemove={model.removeCounter}
        />
      ))}
      <button onClick={model.addCounter}>Add counter</button>
      <button onClick={model.resetAll}>Reset all</button>
    </div>
  );
});

const counterListModel = new CounterListModel();

ReactDOM.render(<CounterList model={counterListModel} />, document.getElementById("root"));
```

## Example 2: TodoMVC. The classics of.

[Repository](https://github.com/zheksoon/dipole-react-todo-mvc)

[Open in Codesandbox](https://codesandbox.io/s/dipole-react-example-todo-mvc-typescript-7rxzw?file=/src/App.tsx)

## Introduction into core features

### Observable  

Observables are containers that contain some value and allow some other dependent objects to get notified when the value changes.  

```js  
import { observable } from 'dipole'  
  
const counter = observable(0)  
counter.get()   // returns 0  
counter.set(1)  // sets observable value to 1  
```

Using `makeObservable` helper it's easy to convert observable properties on some object into convinient getters and setters:

```js
const counter = makeObservable({ count: observable(0) })

counter.count     // return 0
counter.count = 5 // sets observable a to 5
```

Or the same with classes:

```js
class Counter {
  count = observable(0)

  constructor() {
    makeObservable(this)
  }
}

const counter = new Counter()
```

Only object's own properties are converted.

(You may also have noticed that code from [Examples](#examples) section uses `observable.prop` instead of `observable` for defining fields - in fact, it's the same exact function, the only difference is its Typescript definition: type of `observable.prop(T)` is `T`, while type of `observable(T)` is `Observable<T>`)

### Computed  

Computed values are values that are derived from other observables and computeds with some pure function. The function should not contain any side-effects other than returning a value and depend only on observable/computed values. The result of computed is cached until any of its dependencies are changed.  

```js
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

```js  
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
  
a.set('aa')     // `result` doesn't depend on `a`, nothing will happen  
result.get()    // nothing changed for `result`, just returns 'b' again
  
b.set('bb')     // change `result` dependency  
result.get()    // prints 'Computing result' and returns 'bb'  
```  

There are some intuitive limitations for computed values:  

1) They can't recursively refer to itself:  

```javascript  
const recur = computed(() => recur.get() + 1)  
recur.get() // throws 'Trying to get computed value while in computing state'  
```  

2) They must not change any observable or trigger any side-effects:  

```js  
const badBoy = computed(() => counter.set(0))  
badBoy.get()    // throws `Can't change observable value inside of computed`  
```  

### Reaction and transaction  

Reactions are automatic actions that are triggered on dependent observable/computed changes  

```js  
const a = observable(1)  
const b = observable(2)  
const sum = computed(() => a.get() + b.get())  
const r = reaction(() => {  
    console.log(`Sum of ${a.get()} and ${b.get()} is ${sum.get()}`)  
})  
r.run()   // first run should be triggered manually  
          // prints 'Sum of 1 and 2 is 3'  
  
a.set(3)  // prints 'Sum of 3 and 2 is 5'  
b.set(4)  // prints 'Sum of 3 and 4 is 7'  
```  

Last lines show that reaction reacts to **each** change in its dependencies, synchronously. But what if we want to batch changes and run reaction only once after both `a` and `b` changes?
Here's the answer: **transaction**:

```js
// `tx` stands for `transaction`
import { tx } from 'dipole'
  
tx(() => {
    a.set(2)  // doesn't react  
    b.set(3)  // doesn't react too  
})            // prints 'Sum 2 and 3 is 5' right after transaction end  
```

**Actions** are functions wrapped in transaction. But there is also one significant difference with plain transactions: actions are **untracked**. This means that any access to any observable or computed fields performed in action won't be tracked by calling function/reaction. This makes actions building pieces for your application - they could be safely called from any place with predictable consequences:

```js  
import { action } from 'dipole'  
  
const addBoth = action((amount) => {  
    a.set(a.get() + amount)  
    b.set(b.get() + amount)  
})
  
// invoke action, all arguments and `this` are passed to inner function  
addBoth(3)  // prints 'Sum of 5 and 6 is 11' once
```

Sometimes inplace untracked transactions are usefull too, so there is `utx` function for this (`utx` stands for Untracked TX):

```js
class UserModel {
  isLoading = observable.prop(false);
  user = observanle.prop(null);
  error = observable.prop(null);

  constructor() {
    makeObservable(this);
  }

  // async functions can't be wrapped in `action`
  async fetchUser() {
    utx(() => this.isLoading = true);
    try {
      const response = await userService.getData();
      utx(() => {
        this.user = response.user;
        this.isLoading = false;
      });
    } catch (err) {
      utx(() => {
        this.error = err;
        this.isLoading = false;
      })
    }
  }
}
```

`utx` function also returns the result of its body execution, so it could be used for peeking at some observables/computed values without getting them tracked by underlying reaction/computed:

```js
const food = observable('meato')
const pet = observable('doge')

const soMuch = reaction(() => {
    const thatFood = utx(() => food.get());
    console.log(`Feeding ${pet.get()} with ${thatFood}`);
})
soMuch.run();       // Feeding doge with meato, yummy!

food.set('potato')  // nothing happens, food is untracked
pet.set('dino')     // whoops!
```

Reactions could be destroyed, so they will not run after that:  

```js
r.destroy()
a.set(4)    // doesn't react to the change anymore  
```  

Advanced reaction usage with reaction context and manager argument:  

```js
const delayed = reaction(  
    () => console.log(counter.get()),   // reaction body  
    null,                   // reaction context (`this` for reaction body)  
    () => setTimeout(() => delayed.run(), 1000)  // reaction manager, should manage to run `.run()` method somehow  
)
delayed.run()   // prints '3'  
counter.set(4)  // prints '4' after 1 second  
```  

Limitation: please avoid changing reaction's dependencies inside reaction body - this will cause reaction running in an infinite loop:

```javascript  
const forever = reaction(() => counter.set(counter.get() + 1))  
forever.run()   // never ends  
```

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
tx(thunk)
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
