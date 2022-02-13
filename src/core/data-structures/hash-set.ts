// Hash table fill-factor, multiplied by 16
// 12/16 = 75%
const FILL_FACTOR_BY_16 = 11;
const INITIAL_STORAGE_SIZE = 4;

export interface IHashable {
    _hash: number;
}

function newArray(size: number): undefined[] {
    const items = new Array(size);

    for (let i = 0; i < size; i++) {
        items[i] = undefined;
    }

    return items;
}

export class HashSet<T extends IHashable> {
    _items: (undefined | T)[];
    _size: number;
    _maxSizeBeforeClear: number;
    _isInIteration: boolean;

    constructor() {
        this._items = newArray(INITIAL_STORAGE_SIZE);
        this._size = 0;
        this._maxSizeBeforeClear = 0;
        this._isInIteration = false;
    }

    add(item: T): boolean {
        if (this._isInIteration) {
            return false;
        }

        const items = this._items;
        const length = items.length;
        const modulo = length - 1;

        let hash = item._hash & modulo;
        while (items[hash] !== undefined && items[hash] !== item) {
            hash = (hash + 1) & modulo;
        }
        if (items[hash] === undefined) {
            items[hash] = item;

            if (++this._size > (length * FILL_FACTOR_BY_16) >> 4) {
                this._rehashUp(length * 2);
            }

            if (this._maxSizeBeforeClear < this._size) {
                this._maxSizeBeforeClear = this._size;
            }
            return true;
        }
        return false;
    }

    _rehashUp(length: number): void {
        const oldItems = this._items;
        const oldLength = oldItems.length;

        this._items = newArray(length);
        this._size = 0;

        for (let i = 0; i < oldLength; i++) {
            const item = oldItems[i];
            if (item !== undefined) {
                this.add(item);
            }
        }
    }

    remove(item: T): boolean {
        if (this._isInIteration) {
            return false;
        }

        const items = this._items;
        const length = items.length;
        const modulo = length - 1;
        let hash = item._hash & modulo;
        // find element
        while (items[hash] !== undefined && items[hash] !== item) {
            hash = (hash + 1) & modulo;
        }
        if (items[hash] !== undefined) {
            // see https://github.com/leventov/Koloboke/blob/68515672575208e68b61fadfabdf68fda599ed5a/benchmarks/research/src/main/javaTemplates/com/koloboke/collect/research/hash/NoStatesLHashCharSet.java#L194-L212
            let shiftHash = hash;
            let shiftDistance = 1;

            while (true) {
                shiftHash = (shiftHash + 1) & modulo;
                const item = items[shiftHash];
                if (item === undefined) {
                    items[hash] = undefined;
                    break;
                }
                const keyDistance = (shiftHash - item._hash) & modulo;
                if (keyDistance >= shiftDistance) {
                    items[hash] = item;
                    hash = shiftHash;
                    shiftDistance = 1;
                } else {
                    shiftDistance++;
                }
            }

            this._size--;

            return true;
        }
        return false;
    }

    size(): number {
        return this._size;
    }

    forEach(iteratee: (item: T) => void): void {
        this._isInIteration = true;

        const items = this._items;
        const length = items.length;

        for (let i = 0; i < length; i++) {
            const item = items[i];
            if (item !== undefined) {
                iteratee(item);
            }
        }

        this._isInIteration = false;
    }

    clearAndResize(): void {
        const targetSize = this._maxSizeBeforeClear;

        let storageSize = INITIAL_STORAGE_SIZE;
        while (targetSize > (storageSize * FILL_FACTOR_BY_16) >> 4) {
            storageSize *= 2;
        }

        if (storageSize * 4 < this._items.length) {
            this._items = newArray(storageSize);
        } else {
            const items = this._items;
            const length = items.length;

            for (let i = 0; i < length; i++) {
                items[i] = undefined;
            }
        }

        this._size = 0;
        this._maxSizeBeforeClear = 0;
    }
}
