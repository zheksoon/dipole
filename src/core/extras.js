import { glob } from "./globals";
import { tx } from "./transaction";

let gGettersSpyResult = undefined;

export const gettersSpyContext = {};
export const gettersNotifyContext = {};

export function setGetterSpyResult(value) {
    gGettersSpyResult = value;
}

export function fromGetter(gettersThunk) {
    const oldComputedContext = glob.gComputedContext;
    glob.gComputedContext = gettersSpyContext;
    try {
        gettersThunk();
        return gGettersSpyResult;
    } finally {
        glob.gComputedContext = oldComputedContext;
        gGettersSpyResult = undefined;
    }
}

export function notify(gettersThunk) {
    const oldComputedContext = glob.gComputedContext;
    glob.gComputedContext = gettersNotifyContext;
    try {
        tx(gettersThunk);
    } finally {
        glob.gComputedContext = oldComputedContext;
    }
}
