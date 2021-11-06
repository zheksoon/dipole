---
title: Introduction into core features
---
# Introduction into core features

Dipole core consists three main classes: `Observable`, `Computed` and `Reaction`. All the classes can be constructed via non-capitalized factory functions `observable`, `computed` and `reaction` correspondingly without `new` keyword.

## Observable

Observables are containers that contain some value and allow some other dependent objects to get notified when the value changes.

```js
import { observable } from 'dipole'

const counter = observable(0)
counter.get()   // returns 0
counter.set(1)  // sets observable value to 1
```

For sure, it might be not convinient to call `.get()` or `.set()` on every observable access, so [there are some helpers](#observable-utilities) to make the the process easy and transparent.

## Computed

Computed values are values that are derived from other observables and computeds with some pure function. The function should not contain any side-effects other than returning a value and depend only on observable/computed values. The result of computed is cached until any of its dependencies are changed.

```js
import { observable, computed } from 'dipole'

const counter = observable(1)

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

```js
const recur = computed(() => recur.get() + 1)
recur.get() // throws 'Trying to get computed value while in computing state'
```

2) They must not change any observable or trigger any side-effects:

```js
const badBoy = computed(() => counter.set(0))
badBoy.get()    // throws `Can't change observable value inside of computed`
```

## Reaction and transaction

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

### Transaction

Last lines show that reaction reacts to **each** change in its dependencies, synchronously. But what if we want to batch changes and run reaction only once after both `a` and `b` changes?
Here's the answer: **transaction**:

```js
// `tx` stands for `transaction`
import { tx } from 'dipole'

tx(() => {
    a.set(2)  // doesn't react
    b.set(3)  // doesn't react too
})            // prints 'Sum 2 and 3 is 5' right after the transaction end
```

### Action and untracked transaction

**Actions** are functions wrapped in transaction. But there is also one significant difference with plain transactions: actions are **untracked**. This means that any access to any observable or computed fields performed in action won't be tracked by calling function/reaction. This makes actions building pieces of your application - they could be safely called from any place with predictable consequences. 

Actions do really play well with [observable utilities](#observable-utilities), making writing complex mutations simple.

```js
import { observable, action, makeObservable } from 'dipole'

class SumModel {
  constructor(a, b) {
    this.a = observable.prop(a)
    this.b = observable.prop(b)
    makeObservable(this)
  }

  addBoth = action((amount) => {
    this.a += amount
    this.b += amount
  })
}

const model = new SumModel(1, 2);

model.addBoth(3);
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

  // async functions can't be wrapped in `action`, so using `utx` inplace for observable changes
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
const person = observable('Alice')

const government = reaction(() => {
    const who = utx(() => person.get());
    console.log(`${who} is caught!`);
})
government.run();       // Alice is caught! but...

person.set('Anonymous') // you get it! :)
```

Reactions can be destroyed, so they will not run after that:

```js
r.destroy()
a.set(4)    // doesn't react to the change anymore
```

### Nested reactions

Since dipole version 2.2.0 reactions that get created while another reaction is executed become **children** of the parent reaction. Child reactions get automatically destroyed when parent is destroyed or run. 

Why is this needed? 

This behaviour enables building hierarchical constructs, where one reaction (say, router) creates another reaction (say, view or page), and changes that trigger router reaction automatically destroy view reaction, so all related resources could be freed.

For more context, see [this issue](https://github.com/zheksoon/dipole/issues/5).

In case you want intentially create a reaction without parent, just do it inside untracked transaction:

```js
const free = utx(() => reaction(() => { ...reaction body... }));
```

### Advanced reaction usage

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

### Limitations

Please avoid changing reaction's dependencies inside reaction body - this will cause reaction running in an infinite loop:

```js
const forever = reaction(() => counter.set(counter.get() + 1))
forever.run()   // never ends
```

## Reaction utilities

There are two utility functions that can help is some cases:

* `when()` accepts a condition function and body, so body gets executed in untracked transaction each time condition is true:

```js
const cond = observable(false);

const r = when(
    () => cond.get(),
    () => { console.log("Condition is true") }
);

cond.set(true);  // prints "Condition is true"
cond.set(false); // doesn't print
```

* `once()` works the same as `when()` except the fact it runs only once when condition is set to `true`:

```js
const cond = observable(false);

const r = once(
    () => cond.get(),
    () => { console.log("Condition is true") }
);

cond.set(true);  // prints "Condition is true"
cond.set(false); // doesn't print
cond.set(true);  // doesn't print too
```

In all cases, `when()` and `once()` will run body if condition is initially set to `true`.

Returned object is `Reaction` instance, so it could be destroyed or run again as usual reaction.

## Observable utilities

Using `makeObservable` helper it's easy to convert observable properties on some object into convenient getters and setters:

```js
const counter = makeObservable({ count: observable(0) })

counter.count     // return 0
counter.count = 5 // sets observable to 5
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

Only object's own properties [are converted](api.md#makeobservableobject).

(You may also have noticed that code from [Examples](examples.md) section uses `observable.prop` instead of `observable` for defining fields - in fact, it's exactly the same function, the only difference is [its Typescript definition](https://github.com/zheksoon/dipole/blob/master/src/index.d.ts#L30): type of `observable.prop(T)` is `T`, while type of `observable(T)` is `Observable<T>`)

There are also few helper functions designed to work with `makeObservable`: [fromGetter](api.md#fromgetterthunk) and [notify](api.md#notifythunk).
