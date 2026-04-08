/**
 * File overview:
 * Purpose: Shared test fixtures for match-shaped objects used across regression suites.
 * Main exports: buildBaseMatchFixture.
 * Major callers: test files that need a plain in-memory match object.
 * Side effects: none.
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
    actionHistory: [],
    processedActionIds: [],
    ...overrides,
  };
}
