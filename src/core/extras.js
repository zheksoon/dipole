import { glob } from "./globals";
import { tx } from "./transaction";

let gGettersSpyResult = undefined;

export const gettersSpyContext = {};
export const gettersNotifyContext = {};

export function setGetterSpyResult(value) {
    gGettersSpyResult = value;
}

export function fromGetter(gettersThunk) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = gettersSpyContext;
    try {
        gettersThunk();
        return gGettersSpyResult;
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
        gGettersSpyResult = undefined;
    }
}

export function notify(gettersThunk) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = gettersNotifyContext;
    try {
        tx(gettersThunk);
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
    }
}
