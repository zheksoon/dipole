interface GlobalConfig {
    reactionScheduler: (runner: () => void) => void;
    subscribersCheckInterval: number;
    maxReactionIterations: number;
}

export type IConfig = Partial<GlobalConfig>;

export const gConfig: GlobalConfig = {
    reactionScheduler: (runner) => runner(),
    subscribersCheckInterval: 1000,
    maxReactionIterations: 100,
};

export function configure(config: IConfig): void {
    if (config.reactionScheduler) {
        gConfig.reactionScheduler = config.reactionScheduler;
    }
    if (config.subscribersCheckInterval) {
        gConfig.subscribersCheckInterval = config.subscribersCheckInterval;
    }
    if (config.maxReactionIterations) {
        gConfig.maxReactionIterations = config.maxReactionIterations;
    }
}
