# Dipole - fast and simple MobX-like observables

**Dipole** is a simple yet efficient implementation of reactive observable/computed values pattern, as seen in a well-known library MobX.

Dipole aims to a clean and minimalistic implementation of the pattern without abusing Javascript features like closures, weak typing and etc.

## Features:
- Less than 250 lines that compress to about 1K of code (gzipped)
- Written in ES6 (needs only `class` and `Set` support)
- Tiny core - only 3 classes (`Observable`, `Computed`, `Reaction`) and 1 function (`transaction`)
- Opaque data structures
- Good test suite

## Examples:
Import:
```js
const { Observable, Computed, Reaction, transaction } = require('dipole');
```
Define observable values:
```js
const a = new Observable(1);
const b = new Observable(2);

a.get();    // returns 1
a.set(5);   // sets value to 5
```
Define a computed value with automatic tracking of dependencies:
```js
const c = new Computed(() => {
    console.log('Computing a + b...');
    return a.get() + b.get()
});

c.get();    // prints 'Computing a + b...' and returns 7
c.get();    // doesn't print but still returns 7 - the result is cached!
```
Update of any dependency will invalidate the cached result:
```js
b.set(10);
c.get();    // prints 'Computing a + b...' and returns 15
```
Define reaction - a function that will run automatically on any change in dependency chain
```js
const r = new Reaction(() => {
    console.log('c is ', c.get());
});

// reaction won't start until you manually do a first run
r.run();    // prints 'c is 15'
```
Update some observables again...
```js
a.set(20);  // prints 'Computing a + b...' and 'c is 30'
b.set(30);  // prints 'Computing a + b...' and 'c is 50'
```
Hm, but what if you want only single reaction run for multiple updates?

Here the answer: **transactions**!
```js
transaction(() => {
    a.set(1);   // won't print anything
    b.set(2);   // won't print anything too
});
// but will print 'Computing a + b...' and 'c is 3' right here, in a single run!
```
Intermediate results could be accessed inside a transaction:
```js
transaction(() => {
    a.set(10);
    const sum = c.get();    // will print 'Computing a + b...' and return 12
    b.set(sum);
});
// will run reaction and print 'Computing a + b...' and 'c is 22'
```
Reaction can be destroyed, so it will never run on changes after that:
```js
r.destroy();

b.set(10);  // nothing happens
```
Dependencies of computed values and reactions can change:
```js
const greeting = new Observable('hello!')
const parting = new Observable('bye!')
const isGreeting = new Observable(true);

const speaker = new Reaction(() => {
    if (isGreeting.get()) {
        console.log('my greeting is', greeting.get())
    } else {
        console.log('my parting is', parting.get())
    }
});

speaker.run();  // prints 'my greeting is hello!' - `speaker` depends 
                // on `greeting` and `isGreeting` observables

greeting.set('привет!');    // prints 'my greeting is привет!' - dependant value change

isGreeting.set(false);  // prints 'my parting is bye!' - also dependant value change

greeting.set('salut!')  // doesn't print anymore - now `speaker` depends only
                        // on `parting` and `isGreeting` values

parting.set('ciao!')    // prints 'my parting is ciao!'

isGreeting.set(true);   // prints 'my greeting is salut!' and stop listen 
                        // to `parting` changes
```
Computed values can't recursively refer to itself:
```js
const recur = new Computed(() => recur.get() + 1);

recur.get();    // Error: Trying to get computed value while in computing state
```
Computed values should not contain side effects and perform observable mutations:
```js
const bad = new Computed(() => a.set(a.get() + 1));

bad.get();      // Error: Can't change observable value inside of computed
```
Reactions that change their dependencies will run in infinite loop:
```js
const counter = new Observable(0);
const forever = new Reaction(() => {
    counter.set(counter.get() + 1);
});
forever.run();  // never ends
```

## Author
Eugene Daragan

## License
MIT