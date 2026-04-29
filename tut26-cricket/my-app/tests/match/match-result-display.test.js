/**
 * File overview:
 * Purpose: Covers match result display winner-summary behavior in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ../../src/app/lib/match-result-display.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  getWinningInningsSummary,
  getWinningTeamName,
  isTiedMatchResult,
  normalizeMatchResultText,
} from "../../src/app/lib/match-result-display.js";
import { calculateInningsSummary } from "../../src/app/lib/match-stats.js";

test("[match] result display uses the first innings score when the first batting team wins by runs", () => {
  const summary = getWinningInningsSummary({
    result: "Neeraj Giants won by 39 runs.",
    innings1: {
      team: "Neeraj Giants",
      score: 45,
      history: [{ balls: [{ runs: 4, isOut: false }] }],
    },
    innings2: {
      team: "Siddharth Royals",
      score: 6,
      history: [{ balls: [{ runs: 0, isOut: true }] }],
    },
  });

  assert.equal(summary?.teamName, "Neeraj Giants");
  assert.equal(summary?.score, 45);
  assert.equal(summary?.wickets, 0);
  assert.equal(summary?.scoreline, "45/0");
});

test("[match] result display uses the chasing innings score when the second batting team wins by wickets", () => {
  const summary = getWinningInningsSummary({
    result: "Team Blue won by 3 wickets.",
    innings1: {
      team: "Team Red",
      score: 38,
      history: [{ balls: [{ runs: 1, isOut: false }] }],
    },
    innings2: {
      team: "Team Blue",
      score: 39,
      history: [
        {
          balls: [
            { runs: 2, isOut: false },
            { runs: 0, isOut: true },
            { runs: 1, isOut: false },
          ],
        },
      ],
    },
  });

  assert.equal(summary?.teamName, "Team Blue");
  assert.equal(summary?.score, 39);
  assert.equal(summary?.wickets, 1);
  assert.equal(summary?.scoreline, "39/1");
});

test("[match] result display falls back to saved legal-ball counts when winner history is incomplete", () => {
  const summary = getWinningInningsSummary({
    result: "Team Red won by 13 runs.",
    firstInningsLegalBallCount: 36,
    secondInningsLegalBallCount: 30,
    innings1: {
      team: "Team Red",
      score: 95,
      history: [],
    },
    innings2: {
      team: "Team Blue",
      score: 82,
      history: [{ balls: [{ runs: 1, isOut: false }] }],
    },
  });

  assert.equal(summary?.teamName, "Team Red");
  assert.equal(summary?.score, 95);
  assert.equal(summary?.overs, "6.0");
  assert.equal(summary?.scoreline, "95/0");
});

test("[match] innings summary uses saved legal-ball counts when history is incomplete", () => {
  const summary = calculateInningsSummary({
    score: 95,
    history: [],
    legalBallCount: 36,
  });

  assert.equal(summary.overs, "6.0");
  assert.equal(summary.balls, 36);
  assert.equal(summary.runRate, "15.83");
});

test("[match] tied results do not expose a winning team summary", () => {
  const summary = getWinningInningsSummary({
    result: "Match Tied",
    innings1: {
      team: "Team Red",
      score: 44,
      history: [{ balls: [{ runs: 1, isOut: false }] }],
    },
    innings2: {
      team: "Team Blue",
      score: 44,
      history: [{ balls: [{ runs: 1, isOut: true }] }],
    },
  });

  assert.equal(summary, null);
  assert.equal(isTiedMatchResult("Match Tied"), true);
  assert.equal(getWinningTeamName("Match Tied"), "");
});

test("[match] result display repairs stale winner names from the current innings teams", () => {
  const resultText = normalizeMatchResultText(
    {
      innings1: { team: "SHIVA" },
      innings2: { team: "SARDAR4" },
    },
    "SARDAR UNCLE won by 1 wicket.",
  );

  assert.equal(resultText, "SARDAR4 won by 1 wicket.");
});
