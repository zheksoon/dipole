import { AnyComputed } from "../types";

let gScheduledStateActualizations: AnyComputed[] = [];

export function hasScheduledStateActualizations() {
    return gScheduledStateActualizations.length > 0;
}

export function scheduleStateActualization(computed: AnyComputed) {
    gScheduledStateActualizations.push(computed);
}

export function runScheduledStateActualizations() {
    for (let computed; (computed = gScheduledStateActualizations.pop()); ) {
        computed._actualizeAndRecompute();
    }
}
