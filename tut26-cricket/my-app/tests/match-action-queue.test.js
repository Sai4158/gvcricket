import assert from "node:assert/strict";
import test from "node:test";

import { applyMatchAction } from "../src/app/lib/match-engine.js";
import { replayQueuedMatchActions } from "../src/app/components/match/useMatch.js";

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

test("queued scoring actions can be replayed on top of a fresh server snapshot", () => {
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
