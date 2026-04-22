/**
 * File overview:
 * Purpose: Covers Match Fixtures behavior and regression cases in the automated test suite.
 * Main exports: buildBaseMatchFixture.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ../README.md
 */

export function buildBaseMatchFixture(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439011",
    teamA: ["Alice", "Bea", "Cara"],
    teamB: ["Dina", "Esha", "Farah"],
    teamAName: "Falcons",
    teamBName: "Titans",
    overs: 2,
    sessionId: "507f1f77bcf86cd799439012",
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
    activeOverBalls: [],
    activeOverNumber: 1,
    legalBallCount: 0,
    firstInningsLegalBallCount: 0,
    secondInningsLegalBallCount: 0,
    actionHistory: [],
    processedActionIds: [],
    ...overrides,
  };
}


