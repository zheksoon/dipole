import { AnySubscription, IComputed, IObservable } from "./types";
import { Observable } from "../core/classes/observable";
import { GlobalVars, glob } from "./globals/variables";
import { tx } from "./transaction";

type SpecialContext<Type> = object & { _type: Type };

export type GettersSpyContext = SpecialContext<"GettersSpyContext">;

export type NotifyContext = SpecialContext<"NotifyContext">;

let gGettersSpyResult: undefined | IObservable<unknown> | IComputed<unknown> = undefined;

const gettersSpyContext = {} as GettersSpyContext;
const gettersNotifyContext = {} as NotifyContext;

export function checkSpecialContexts(
    context: GlobalVars["gSubscriberContext"],
    target: AnySubscription
): context is (GettersSpyContext | NotifyContext) {
    if (context === gettersSpyContext) {
        gGettersSpyResult = target;
        return true;
    }

    if (context === gettersNotifyContext) {
        if (target instanceof Observable) {
            target.notify();
            return true;
        } else {
            throw new Error("Trying to notify not Observable instance");
        }
    }

    return false;
}

export function fromGetter(
    gettersThunk: () => unknown
): undefined | IObservable<unknown> | IComputed<unknown> {
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

export function notify(gettersThunk: () => unknown) {
    const oldSubscriberContext = glob.gSubscriberContext;
    glob.gSubscriberContext = gettersNotifyContext;
    try {
        tx(gettersThunk);
    } finally {
        glob.gSubscriberContext = oldSubscriberContext;
    }
}
