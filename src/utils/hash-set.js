// Hash table fill-factor, multiplied by 16
// 11/16 = 68.75%
const FILL_FACTOR_BY_16 = 11;

// Minimal hash table length
const MIN_HASH_LENGTH = 4;


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
                this._rehashUp(length << 1);
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
        const items = this._items;
        const modulo = length - 1;
        const oldLength = items.length;

        // resize the table and fill it with 'undefined' - gives performance boost for V8
        items.length = length;
        for (let i = oldLength; i < length; i++) {
            items[i] = undefined;
        }

        // doubling the length of the table reveals one more bit in item's hash
        // so each item may stay in the same half of the table or move to another one.
        // reinserting into another (empty) half of hash table doesn't generate any special cases,
        // but reinserting into the same half of hash table has some special cases.
        // let's imagine a very simple hash table:
        // [ # 1 # 7 ], where # designates empty cell, and a number is an element's hash.
        // and try to insert, say, element with hash 3:
        // [ 3 1 # 7 ]. (it was aliased with 7 and wrapped to the first empty cell after it)
        // when rehashing this table up (doubling its size), at some moment the 3 will be inserted 
        // after the 7 because we still haven't reinserted the 7 (only the 3 was processed):
        // [ # 1 # 7 3 # # # ]
        // so if we process only the lower half of the table
        // the result will be invalid hash table (the 3 can't be found on its place):
        // [ # 1 # # 3 # # 7 ].
        // to avoid this, we need to process an extra probing sequence after the first half
        // to move elements to their correct places:
        // [ # 1 # 3 # # # 7 ].
        // this is as simple as 'continue; else break;' statement lower, but it took few days to realize it :)
        // it can be proven that only the extra sequence can contain elements with invalid positions.
        for (let i = 0; i < length; i++) {
            const item = items[i];
            if (item === undefined) {
                if (i < oldLength) continue; else break;
            }
            items[i] = undefined;

            let hash = item._hash & modulo;
            while (items[hash] !== undefined) {
                hash = (hash + 1) & modulo;
            }

            items[hash] = item;
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
            // robin-hood strategy
            let moveHash = (hash + 1) & modulo;
            while (items[moveHash] !== undefined) {
                moveHash = (moveHash + 1) & modulo;
            }
            moveHash = (moveHash - 1) & modulo;
            items[hash] = items[moveHash];
            items[moveHash] = undefined;
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
}


export default HashSet