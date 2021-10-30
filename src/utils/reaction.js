import { reaction } from "../core/classes";
import { utx } from "../core/transaction";

export function when(conditionFn, body) {
    const r = reaction(() => {
        const cond = conditionFn();
        if (cond) {
            utx(body);
        }
    });
    r.run();
    return r;
}

export function once(conditionFn, body) {
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
