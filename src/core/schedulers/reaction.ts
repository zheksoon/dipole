import { AnyReaction } from "../types";
import { gConfig } from "../globals/config";
import {
    hasScheduledStateActualizations,
    runScheduledStateActualizations,
} from "./stateActualization";

let gScheduledReactions: (AnyReaction | null)[] = [];
let gScheduledReactionsStartIndex: number = 0;

export function scheduleReaction(reaction: AnyReaction) {
    gScheduledReactions.push(reaction);
}

let reactionIterationsLeft = 0;

function runScheduledReactions() {
    let endIndex = gScheduledReactions.length;

    while (gScheduledReactionsStartIndex < endIndex && reactionIterationsLeft > 0) {
        for (; gScheduledReactionsStartIndex < endIndex; gScheduledReactionsStartIndex++) {
            const reaction = gScheduledReactions[gScheduledReactionsStartIndex];
            gScheduledReactions[gScheduledReactionsStartIndex] = null;

            if (reaction !== null && reaction._shouldRun()) {
                reaction.runManager();
            }
        }
        endIndex = gScheduledReactions.length;
        reactionIterationsLeft -= 1;
    }

    if (gScheduledReactionsStartIndex < endIndex && reactionIterationsLeft === 0) {
        console.error(
            `Possible infinite reaction loop: did not converge after ${gConfig.maxReactionIterations} iterations`
        );
    }

    gScheduledReactions = [];
    gScheduledReactionsStartIndex = 0;
}

function shouldRunReactionLoop() {
    return gScheduledReactions.length > 0 || hasScheduledStateActualizations();
}

let isReactionRunnerScheduled = false;

function reactionRunner() {
    try {
        isReactionRunnerScheduled = true;

        while (shouldRunReactionLoop()) {
            runScheduledStateActualizations();
            runScheduledReactions();
        }
    } finally {
        isReactionRunnerScheduled = false;
    }
}

export function endTransaction() {
    if (!isReactionRunnerScheduled && shouldRunReactionLoop()) {
        isReactionRunnerScheduled = true;
        reactionIterationsLeft = gConfig.maxReactionIterations;
        gConfig.reactionScheduler(reactionRunner);
    }
}
