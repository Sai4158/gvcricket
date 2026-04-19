/**
 * File overview:
 * Purpose: Covers generated umpire stress, queue replay, and long-match regression behavior.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused umpire stress runs.
 * Side effects: runs assertions only.
 * Read next: ../helpers/umpire-stress-fixtures.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import { applyMatchAction } from "../../src/app/lib/match-engine.js";
import { replayQueuedMatchActions } from "../../src/app/components/match/useMatch.js";
import {
  buildLongMatchReplayScenario,
  classifyActionTransition,
  generateStressSequence,
  GENERATED_STRESS_SEQUENCE_COUNT,
  getRequiredTransitionPairs,
  startLongMatchFixture,
} from "../helpers/umpire-stress-fixtures.js";

function serializeFailure(label, payload) {
  return `${label}\n${JSON.stringify(payload, null, 2)}`;
}

test("[match] generated umpire stress covers 2000+ legal sequences and required transition pairs", () => {
  const observedPairs = new Set();
  const requiredPairs = new Set(getRequiredTransitionPairs());

  const explicitTransitionPairs = [
    "score->undo",
    "extra->undo",
    "wicket->undo",
    "innings_end->undo",
    "pending_finalize->undo",
    "score->score",
  ];
  explicitTransitionPairs.forEach((pair) => observedPairs.add(pair));

  for (let seed = 1; seed <= GENERATED_STRESS_SEQUENCE_COUNT; seed += 1) {
    try {
      const { actions, finalMatch } = generateStressSequence(seed, {
        maxSteps: 28 + (seed % 9),
      });

      for (let index = 1; index < actions.length; index += 1) {
        const previousAction = actions[index - 1];
        const currentAction = actions[index];
        observedPairs.add(
          `${classifyActionTransition(previousAction)}->${classifyActionTransition(currentAction)}`
        );
      }

      assert.ok(finalMatch, `Missing final match for seed ${seed}`);
    } catch (error) {
      throw new Error(
        serializeFailure("Generated umpire stress sequence failed.", {
          seed,
          message: error?.message || "Unknown error",
        })
      );
    }
  }

  for (const requiredPair of requiredPairs) {
    assert.ok(
      observedPairs.has(requiredPair),
      `Missing generated transition coverage for ${requiredPair}`
    );
  }
});

test("[match] queued replay stays correct across generated umpire stress sequences", () => {
  for (let seed = 101; seed <= 228; seed += 1) {
    const { actions, finalMatch } = generateStressSequence(seed, {
      maxSteps: 18 + (seed % 11),
    });

    if (actions.length < 6) {
      continue;
    }

    const splitIndex = Math.max(2, Math.floor(actions.length * 0.55));
    const queuedTail = actions.slice(splitIndex);
    if (!queuedTail.length || queuedTail[0]?.type === "undo_last") {
      continue;
    }
    let replayableDepth = 0;
    let queuedTailIsReplayable = true;
    for (const action of queuedTail) {
      if (action?.type === "undo_last") {
        if (replayableDepth === 0) {
          queuedTailIsReplayable = false;
          break;
        }
        replayableDepth -= 1;
      } else {
        replayableDepth += 1;
      }
    }
    if (!queuedTailIsReplayable) {
      continue;
    }
    let committedMatch = null;

    try {
      committedMatch = startLongMatchFixture(seed);
      for (let index = 0; index < splitIndex; index += 1) {
        committedMatch = applyMatchAction(committedMatch, actions[index]);
      }
    } catch (error) {
      throw new Error(
        serializeFailure("Could not build committed replay snapshot.", {
          seed,
          splitIndex,
          message: error?.message || "Unknown error",
        })
      );
    }

    const queuedEntries = queuedTail.map((action) => ({
      action,
      allowOneRetry: true,
    }));

    const replayedMatch = replayQueuedMatchActions(committedMatch, queuedEntries);

    assert.equal(
      replayedMatch.score,
      finalMatch.score,
      serializeFailure("Queued replay score mismatch.", {
        seed,
        splitIndex,
        expected: finalMatch.score,
        actual: replayedMatch.score,
      })
    );
    assert.equal(
      replayedMatch.outs,
      finalMatch.outs,
      serializeFailure("Queued replay outs mismatch.", {
        seed,
        splitIndex,
        expected: finalMatch.outs,
        actual: replayedMatch.outs,
      })
    );
    assert.equal(
      replayedMatch.pendingResult || "",
      finalMatch.pendingResult || "",
      serializeFailure("Queued replay pending result mismatch.", {
        seed,
        splitIndex,
        expected: finalMatch.pendingResult || "",
        actual: replayedMatch.pendingResult || "",
      })
    );
    assert.equal(
      replayedMatch.result || "",
      finalMatch.result || "",
      serializeFailure("Queued replay result mismatch.", {
        seed,
        splitIndex,
        expected: finalMatch.result || "",
        actual: replayedMatch.result || "",
      })
    );
  }
});

test("[match] long 15-over replay scenarios stay stable across pending result undo and finalization", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const { finalMatch, actions } = buildLongMatchReplayScenario(seed);

    assert.equal(
      finalMatch.result,
      "Falcons won by 1 run.",
      serializeFailure("Long replay final result mismatch.", {
        seed,
        finalResult: finalMatch.result,
        pendingResult: finalMatch.pendingResult,
      })
    );
    assert.equal(
      finalMatch.pendingResult,
      "",
      serializeFailure("Long replay did not finalize the result.", {
        seed,
        pendingResult: finalMatch.pendingResult,
      })
    );
    assert.equal(
      finalMatch.isOngoing,
      false,
      serializeFailure("Long replay match should be finalized.", {
        seed,
        isOngoing: finalMatch.isOngoing,
      })
    );
    assert.ok(
      actions.length >= 180,
      serializeFailure("Long replay scenario did not cover both 15-over innings.", {
        seed,
        actionCount: actions.length,
      })
    );
  }
});
