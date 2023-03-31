export const enum State {
    NOT_INITIALIZED = 0,
    COMPUTING = 1,
    CLEAN = 2,
    MAYBE_DIRTY = 3,
    DIRTY = 4,
    DESTROYED_BY_PARENT = 5,
    PASSIVE = 6,
};
