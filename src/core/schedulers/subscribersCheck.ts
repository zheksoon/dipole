import { AnyComputed } from "../types";
import { DebounceQueue, ImmediateQueue } from "../dataStructures/debounceQueue";
import { defaultSubscribersCheckInterval } from "../globals/defaults";

let gSubscribersCheckQueue: ImmediateQueue<AnyComputed> | DebounceQueue<AnyComputed> =
    new DebounceQueue(subscribersCheckCallback, defaultSubscribersCheckInterval);

let itemsToCheck: Set<AnyComputed> | null = null;

function subscribersCheckCallback(computedsToCheck: Set<AnyComputed>) {
    itemsToCheck = computedsToCheck;

    computedsToCheck.forEach((computed) => {
        if (!computed._hasSubscribers()) {
            computed.destroy();
        }
    });

    itemsToCheck = null;
}

export function scheduleSubscribersCheck(computed: AnyComputed) {
    if (!itemsToCheck) {
        gSubscribersCheckQueue.add(computed);
    } else {
        itemsToCheck.add(computed);
    }
}

export function removeFromSubscribersCheck(computed: AnyComputed) {
    gSubscribersCheckQueue.remove(computed);
}

export function triggerImmediateSubscribersCheck() {
    gSubscribersCheckQueue.processImmediately();
}

export function setSubscribersCheckInterval(interval: number) {
    if (interval === 0) {
        gSubscribersCheckQueue = new ImmediateQueue(subscribersCheckCallback);
    } else {
        gSubscribersCheckQueue = new DebounceQueue(subscribersCheckCallback, interval);
    }
}
