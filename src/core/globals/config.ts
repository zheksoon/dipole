import { setSubscribersCheckInterval } from "../schedulers/subscribersCheck";
import {
    defaultMaxReactionIterations,
    defaultReactionScheduler,
    defaultSubscribersCheckInterval,
} from "./defaults";

interface GlobalConfig {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
    maxReactionIterations: number;
}

export type IConfig = Partial<GlobalConfig>;

export const gConfig: GlobalConfig = {
    reactionScheduler: defaultReactionScheduler,
    subscribersCheckInterval: defaultSubscribersCheckInterval,
    maxReactionIterations: defaultMaxReactionIterations,
};

export function configure(config: IConfig): void {
    if (config.reactionScheduler) {
        gConfig.reactionScheduler = config.reactionScheduler;
    }
    if (config.subscribersCheckInterval != null && config.subscribersCheckInterval >= 0) {
        gConfig.subscribersCheckInterval = config.subscribersCheckInterval;
        setSubscribersCheckInterval(config.subscribersCheckInterval);
    }
    if (config.maxReactionIterations) {
        gConfig.maxReactionIterations = config.maxReactionIterations;
    }
}
