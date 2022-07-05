import { AnySubscriber } from "../types";
import { GettersSpyContext, NotifyContext } from "../extras";

export interface GlobalVars {
    gSubscriberContext: GettersSpyContext | NotifyContext | AnySubscriber | null;
    gTransactionDepth: number;
}

export const glob: GlobalVars = {
    gSubscriberContext: null,
    gTransactionDepth: 0,
};
