import { reaction } from "../core/classes/reaction";
import { IReaction } from "../core/types";
import { utx } from "../core/transaction";

export function when(conditionFn: () => boolean, body: () => unknown): IReaction<null, [], void> {
    const r = reaction(() => {
        const cond = conditionFn();
        if (cond) {
            utx(body);
        }
    });
    r.run();
    return r;
}

export function once(conditionFn: () => boolean, body: () => unknown): IReaction<null, [], void> {
    const r = reaction(() => {
        const cond = conditionFn();
        if (cond) {
            r.destroy();
            utx(body);
        }
    });
    r.run();
    return r;
}
