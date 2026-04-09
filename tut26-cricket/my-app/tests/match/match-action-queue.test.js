/**
 * File overview:
 * Purpose: Covers Match Action Queue.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import assert from "node:assert/strict";
import test from "node:test";

import { applyMatchAction } from "../../src/app/lib/match-engine.js";
import {
  filterQueuedActionsAlreadyApplied,
  isIncomingUpdateOlder,
  isMatchNetworkError,
  removeQueuedActionById,
  replayQueuedMatchActions,
  updateQueuedActionRetryFlag,
} from "../../src/app/components/match/useMatch.js";

function actionId(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildStartedMatch() {
  const baseMatch = {
    _id: "507f1f77bcf86cd799439121",
    teamA: ["A1", "A2", "A3"],
    teamB: ["B1", "B2", "B3"],
    teamAName: "Red",
    teamBName: "Blue",
    overs: 2,
    sessionId: "507f1f77bcf86cd799439122",
    tossWinner: "",
    tossDecision: "",
    score: 0,
    outs: 0,
    isOngoing: true,
    innings: "first",
    result: "",
    innings1: { team: "", score: 0, history: [] },
    innings2: { team: "", score: 0, history: [] },
    balls: [],
    actionHistory: [],
    processedActionIds: [],
    announcerEnabled: true,
    announcerMode: "simple",
  };

  return applyMatchAction(baseMatch, {
    type: "set_toss",
    tossWinner: "Red",
    tossDecision: "bat",
    actionId: actionId("toss"),
  });
}

test("[match] match network classifier catches transient browser fetch failures", () => {
  assert.equal(isMatchNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isMatchNetworkError(new TypeError("Load failed")), true);
  assert.equal(isMatchNetworkError(new Error("Failed to update match.")), false);
});

test("[match] stale stream updates are ignored while newer updates continue to apply", () => {
  assert.equal(
    isIncomingUpdateOlder(
      "2026-04-09T12:00:00.000Z",
      "2026-04-09T12:00:00.100Z",
    ),
    true,
  );
  assert.equal(
    isIncomingUpdateOlder(
      "2026-04-09T12:00:00.100Z",
      "2026-04-09T12:00:00.100Z",
    ),
    false,
  );
  assert.equal(
    isIncomingUpdateOlder(
      "2026-04-09T12:00:00.200Z",
      "2026-04-09T12:00:00.100Z",
    ),
    false,
  );
  assert.equal(
    isIncomingUpdateOlder("not-a-date", "2026-04-09T12:00:00.100Z"),
    false,
  );
});

test("[match] queued scoring actions can be replayed on top of a fresh server snapshot", () => {
  const startedMatch = buildStartedMatch();
  const serverMatch = applyMatchAction(startedMatch, {
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
    actionId: actionId("server-score"),
  });

  const replayedMatch = replayQueuedMatchActions(serverMatch, [
    {
      action: {
        type: "score_ball",
        runs: 4,
        isOut: false,
        extraType: null,
        actionId: actionId("queued-four"),
      },
      allowOneRetry: true,
    },
    {
      action: {
        type: "score_ball",
        runs: 0,
        isOut: true,
        extraType: null,
        actionId: actionId("queued-out"),
      },
      allowOneRetry: true,
    },
  ]);

  assert.equal(replayedMatch.score, 5);
  assert.equal(replayedMatch.outs, 1);
  assert.equal(replayedMatch.innings1.score, 5);
  assert.equal(replayedMatch.actionHistory.length, 4);
});

test("[match] queue helpers drop applied actions and persist retry flag changes safely", () => {
  const queuedEntries = [
    {
      action: {
        type: "score_ball",
        runs: 1,
        isOut: false,
        extraType: null,
        actionId: "action-1",
      },
      allowOneRetry: true,
    },
    {
      action: {
        type: "complete_innings",
        actionId: "action-2",
      },
      allowOneRetry: true,
    },
  ];

  const filteredQueue = filterQueuedActionsAlreadyApplied(
    {
      actionHistory: [{ actionId: "action-1" }],
    },
    queuedEntries,
  );
  assert.deepEqual(filteredQueue.map((entry) => entry.action.actionId), ["action-2"]);

  const updatedRetryQueue = updateQueuedActionRetryFlag(
    queuedEntries,
    "action-2",
    false,
  );
  assert.equal(updatedRetryQueue[1].allowOneRetry, false);
  assert.equal(updatedRetryQueue[0].allowOneRetry, true);

  const trimmedQueue = removeQueuedActionById(updatedRetryQueue, "action-2");
  assert.deepEqual(trimmedQueue.map((entry) => entry.action.actionId), ["action-1"]);
});


