import { IComputed, IObservable } from "./classes/types";
import { glob } from "./globals";
import { tx } from "./transaction";

type GettersSpyResult = IObservable<unknown> | IComputed<unknown>;

export type SpecialContext<Type> = object & { _type: Type }; 

let gGettersSpyResult: undefined | GettersSpyResult = undefined;

export const gettersSpyContext = {} as SpecialContext<"GettersSpyContext">;
export const gettersNotifyContext = {} as SpecialContext<"NotifyContext">;

export function setGetterSpyResult(value: GettersSpyResult) {
    gGettersSpyResult = value;
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
