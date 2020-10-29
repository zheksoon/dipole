// Hash table fill-factor, multiplied by 16
// 12/16 = 75%
const FILL_FACTOR_BY_16 = 12;

/**
* Creates new HashSet
* @constructor
*/
class HashSet {
    constructor() {
        this._items = [undefined, undefined, undefined, undefined];
        this._size = 0;
    }

    /**
    * Adds item to HashSet. Returns true if item was added,
    * or false if item was already is HashSet
    * @param item {object} - item to add
    */
    add(item) {
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
            return true;
        }
        return false;
    }

    /**
    * Rehashes hash table up to a bigger size
    * @private
    * @param length {int} - new hash table length, should be power of 2
    */
    _rehashUp(length) {
        const oldItems = this._items;
        const oldLength = oldItems.length;

        const newItems = new Array(length);
        for (let i = 0; i < length; i++) {
            newItems[i] = undefined;
        }
        this._items = newItems;
        this._size = 0;

        for (let i = 0; i < oldLength; i++) {
            const item = oldItems[i];
            if (item !== undefined) {
                this.add(item)
            }
        }
    }

    /**
    * Removed item from HashSet. Returns true if item was removed,
    * false if item wasn't found in hash table. Do not rehash table at the moment.
    * @param item {object} - item to remove
    */
    remove(item) {
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

    /** 
    * Returns hash table items storage. Storage items 
    * should be checked for undefined before any use.
    */
    items() {
        return this._items;
    }

    /** 
    * Returns hash table size
    */
    size() {
        return this._size;
    }

    getDesiredStorageSize(itemsCount) {
        let storageSize = 4;
        while (itemsCount > (storageSize * FILL_FACTOR_BY_16) >> 4) storageSize *= 2;
        return storageSize;
    }

    setStorageSize(storageSize) {
        // storageSize must be power of 2
        // _items should be empty at the moment
        this._items.length = storageSize;
    }
}


export default HashSet