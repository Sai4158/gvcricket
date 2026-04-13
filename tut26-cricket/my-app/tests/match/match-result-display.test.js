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

import { getWinningInningsSummary } from "../../src/app/lib/match-result-display.js";

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
