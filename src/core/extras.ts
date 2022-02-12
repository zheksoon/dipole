import { Observable } from "./classes";
import { AnySubscription, IComputed, IObservable } from "./classes/types";
import { glob } from "./globals";
import { tx } from "./transaction";

type GettersSpyResult = IObservable<unknown> | IComputed<unknown>;

type SpecialContext<Type> = object & { _type: Type };

export type GettersSpyContext = SpecialContext<"GettersSpyContext">;

export type NotifyContext = SpecialContext<"NotifyContext">;

let gGettersSpyResult: undefined | GettersSpyResult = undefined;

const gettersSpyContext = {} as GettersSpyContext;
const gettersNotifyContext = {} as NotifyContext;

export function checkSpecialContexts(self: AnySubscription) {
    const { gSubscriberContext } = glob;

    if (gSubscriberContext === gettersSpyContext) {
        gGettersSpyResult = self;
        return true;
    }

    if (gSubscriberContext === gettersNotifyContext) {
        if (self instanceof Observable) {
            self.notify();
            return true;
        } else {
            throw new Error("Trying to notify not Observable instance");
        }
    }

    return false;
}

export function fromGetter(gettersThunk: () => any): undefined | GettersSpyResult {
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

export function notify(gettersThunk: () => any) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = gettersNotifyContext;
    try {
        tx(gettersThunk);
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
    }
}
