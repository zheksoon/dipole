# Examples using React bindings

## Example 0: Counter. Basics of observables and actions

[Open in Codesandbox](https://codesandbox.io/s/dipole-react-example-counter-o4w64)

```jsx
import { action, observable, makeObservable } from "dipole";
import { observer } from "dipole-react";

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
    // as observables are dumb containers for data,
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
