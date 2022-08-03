// DebounceQueue performs debounce operation on `add` method on arbitrary amount of items using just 1 timer.
//
// When `add` is called, callback call is scheduled within (timeout, 2 * timeout) period.
// When `add` is called again with the same item, the scheduled callback is reset.
//
// For the given timer precision, all operations are O(1), but it's possible to generalize the solution
// for arbitrary good precision with O(m) complexity, where `m` is timeout / timer resolution.
export class DebounceQueue<T> {
    private _currentItems = new Set<T>();
    private _futureItems = new Set<T>();
    private _timeout: ReturnType<typeof setTimeout> | null = null;

    constructor(private _callback: (items: Set<T>) => void, private _interval: number) {}

    add(item: T) {
        this._futureItems.add(item);
        this._currentItems.delete(item);

        this._setTimeout();
    }

    remove(item: T) {
        this._futureItems.delete(item);
        this._currentItems.delete(item);
    }

    processImmediately() {
        this._processItems();
    }

    private _setTimeout() {
        if (!this._timeout) {
            this._timeout = setTimeout(this._processItems, this._interval);
        }
    }

    private _processItems = () => {
        if (this._timeout) {
            clearTimeout(this._timeout!);
            this._timeout = null;
        }

        const currentQueue = this._currentItems;

        this._currentItems = this._futureItems;
        this._futureItems = new Set();

        this._callback(currentQueue);

        if (this._currentItems.size > 0) {
            this._setTimeout();
        }
    };
}

export class ImmediateQueue<T> {
    private _items: Set<T> = new Set();

    constructor(private _callback: (items: Set<T>) => void) {}

    add(item: T) {
        this._items.add(item);
    }

    remove(item: T) {
        this._items.delete(item);
    }

    processImmediately() {
        this._callback(this._items);
        this._items.clear();
    }
}
