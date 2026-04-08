/**
 * File overview:
 * Purpose: Match engine, toss normalization, and scoring safety regression coverage.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import {
  MatchEngineError,
  applyMatchAction,
  applySafeMatchPatch,
  assert,
  buildBaseMatch,
  buildWinByWicketsText,
  countLegalBalls,
  getStartedMatchFromPayload,
  getStartedMatchId,
  hasCompleteTossState,
  normalizeLegacyTossState,
  serializePublicMatch,
  test,
} from "./security-test-helpers.js";

test("[security] match engine enforces toss-first scoring, undo, and legal innings transitions", () => {
  const baseMatch = buildBaseMatch();

  assert.throws(
    () =>
      applyMatchAction(baseMatch, {
        actionId: "score:before-toss",
        type: "score_ball",
        runs: 1,
        isOut: false,
        extraType: null,
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );

  const afterToss = applyMatchAction(baseMatch, {
    actionId: "toss:1",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });
  assert.equal(afterToss.innings1.team, "Falcons");
  assert.equal(afterToss.innings2.team, "Titans");
  assert.equal(afterToss.actionHistory.length, 1);

  const afterScore = applyMatchAction(afterToss, {
    actionId: "score:1",
    type: "score_ball",
    runs: 4,
    isOut: false,
    extraType: null,
  });
  assert.equal(afterScore.score, 4);
  assert.equal(afterScore.innings1.score, 4);
  assert.equal(afterScore.undoCount, undefined);
  assert.equal(afterScore.actionHistory.length, 2);

  const undone = applyMatchAction(afterScore, {
    actionId: "undo:1",
    type: "undo_last",
  });
  assert.equal(undone.score, 0);
  assert.equal(undone.innings1.score, 0);
  assert.equal(undone.actionHistory.length, 1);

  assert.throws(
    () =>
      applyMatchAction(afterToss, {
        actionId: "advance:too-soon",
        type: "complete_innings",
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );
});


test("[security] extras stay legal, do not consume legal balls, and wicket margin stays accurate", () => {
  const afterToss = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:2",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });

  const afterWide = applyMatchAction(afterToss, {
    actionId: "score:wide",
    type: "score_ball",
    runs: 0,
    isOut: false,
    extraType: "wide",
  });
  assert.equal(afterWide.score, 0);
  assert.equal(countLegalBalls(afterWide.innings1.history), 0);

  const afterSingleWide = applyMatchAction(afterWide, {
    actionId: "score:wide-single",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "wide",
  });
  assert.equal(afterSingleWide.score, 1);
  assert.equal(countLegalBalls(afterSingleWide.innings1.history), 0);

  const afterNoBall = applyMatchAction(afterSingleWide, {
    actionId: "score:noball",
    type: "score_ball",
    runs: 0,
    isOut: false,
    extraType: "noball",
  });
  assert.equal(afterNoBall.score, 1);
  assert.equal(countLegalBalls(afterNoBall.innings1.history), 0);

  const afterSingleNoBall = applyMatchAction(afterNoBall, {
    actionId: "score:noball-single",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "noball",
  });
  assert.equal(afterSingleNoBall.score, 2);
  assert.equal(countLegalBalls(afterSingleNoBall.innings1.history), 0);

  const chaseMatch = {
    ...buildBaseMatch(),
    innings: "second",
    score: 11,
    outs: 1,
    innings1: { team: "Falcons", score: 10, history: [] },
    innings2: { team: "Titans", score: 11, history: [] },
  };
  assert.equal(buildWinByWicketsText(chaseMatch, 1), "Titans won by 2 wickets.");
});


test("[security] full match flow stays accurate across innings change and target chase", () => {
  let match = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:full-flow",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });

  for (let index = 0; index < 12; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:first-${index}`,
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
    });
  }

  assert.equal(match.score, 12);
  assert.equal(match.innings1.score, 12);
  assert.equal(countLegalBalls(match.innings1.history), 12);

  match = applyMatchAction(match, {
    actionId: "advance:second-innings",
    type: "complete_innings",
  });

  assert.equal(match.innings, "second");
  assert.equal(match.score, 0);
  assert.equal(match.outs, 0);
  assert.equal(match.isOngoing, true);

  match = applyMatchAction(match, {
    actionId: "score:chase-4",
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
  });
  match = applyMatchAction(match, {
    actionId: "score:chase-3",
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
  });
  match = applyMatchAction(match, {
    actionId: "score:chase-1",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
  });

  assert.equal(match.score, 13);
  assert.equal(match.innings2.score, 13);
  assert.equal(match.isOngoing, false);
  assert.equal(match.result, "Titans won by 3 wickets.");

  assert.throws(
    () =>
      applyMatchAction(match, {
        actionId: "score:after-finish",
        type: "score_ball",
        runs: 1,
        isOut: false,
        extraType: null,
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );
});


test("[security] the last remaining batter can continue until the final wicket falls", () => {
  let match = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:last-batter",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });

  match = applyMatchAction(match, {
    actionId: "score:last-batter-wicket-1",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });

  match = applyMatchAction(match, {
    actionId: "score:last-batter-wicket-2",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });

  assert.equal(match.outs, 2);
  assert.equal(match.isOngoing, true);

  match = applyMatchAction(match, {
    actionId: "score:last-batter-run",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
  });

  assert.equal(match.score, 1);
  assert.equal(match.isOngoing, true);

  match = applyMatchAction(match, {
    actionId: "score:last-batter-final-wicket",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });

  assert.equal(match.outs, 3);
  assert.equal(match.isOngoing, true);

  assert.throws(
    () =>
      applyMatchAction(match, {
        actionId: "score:after-all-out",
        type: "score_ball",
        runs: 1,
        isOut: false,
        extraType: null,
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );
});


test("[security] second innings ends immediately when the final wicket falls short of the target", () => {
  let match = applyMatchAction(
    {
      ...buildBaseMatch(),
      overs: 1,
    },
    {
      actionId: "toss:second-all-out",
      type: "set_toss",
      tossWinner: "Falcons",
      tossDecision: "bat",
    }
  );

  for (let index = 0; index < 6; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:first-complete-${index}`,
      type: "score_ball",
      runs: index < 2 ? 1 : 0,
      isOut: false,
      extraType: null,
    });
  }

  match = applyMatchAction(match, {
    actionId: "advance:all-out-second",
    type: "complete_innings",
  });

  match = applyMatchAction(match, {
    actionId: "score:second-out-1",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });
  match = applyMatchAction(match, {
    actionId: "score:second-out-2",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });
  match = applyMatchAction(match, {
    actionId: "score:second-out-3",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });

  assert.equal(match.isOngoing, false);
  assert.equal(match.result, "Falcons won by 2 runs.");
  assert.equal(match.lastLiveEvent?.type, "match_end");
});


test("[security] second innings ends immediately when the final legal ball completes the chase attempt", () => {
  let match = applyMatchAction(
    {
      ...buildBaseMatch(),
      overs: 1,
    },
    {
      actionId: "toss:second-over-end",
      type: "set_toss",
      tossWinner: "Falcons",
      tossDecision: "bat",
    }
  );

  for (let index = 0; index < 6; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:first-over-${index}`,
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
    });
  }

  match = applyMatchAction(match, {
    actionId: "advance:second-over-end",
    type: "complete_innings",
  });

  for (let index = 0; index < 6; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:second-over-${index}`,
      type: "score_ball",
      runs: index === 5 ? 0 : 1,
      isOut: false,
      extraType: null,
    });
  }

  assert.equal(match.isOngoing, false);
  assert.equal(match.result, "Falcons won by 1 run.");
  assert.equal(match.lastLiveEvent?.type, "match_end");
});


test("[security] legacy toss state can be recovered from linked session fallback data", () => {
  const legacyMatch = {
    ...buildBaseMatch(),
    tossWinner: "",
    tossDecision: "",
    innings1: { team: "", score: 0, history: [] },
    innings2: { team: "", score: 0, history: [] },
  };

  const normalized = normalizeLegacyTossState(legacyMatch, {
    tossWinner: "Falcons",
    tossDecision: "bat",
    teamAName: "Falcons",
    teamBName: "Titans",
    teamA: ["Alice", "Bea", "Cara"],
    teamB: ["Dina", "Esha", "Farah"],
  });

  assert.equal(normalized.tossWinner, "Falcons");
  assert.equal(normalized.tossDecision, "bat");
  assert.equal(normalized.innings1.team, "Falcons");
  assert.equal(normalized.innings2.team, "Titans");
  assert.equal(normalized.tossReady, true);
});


test("[security] umpire scoring combinations undo extras and over completion cleanly", () => {
  let match = applyMatchAction(
    {
      ...buildBaseMatch(),
      overs: 1,
    },
    {
    actionId: "toss:combo",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
    }
  );

  match = applyMatchAction(match, {
    actionId: "score:one",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
  });
  match = applyMatchAction(match, {
    actionId: "score:wide",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "wide",
  });
  match = applyMatchAction(match, {
    actionId: "score:noball",
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: "noball",
  });
  match = applyMatchAction(match, {
    actionId: "score:wicket",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });

  assert.equal(match.score, 4);
  assert.equal(match.outs, 1);
  assert.equal(countLegalBalls(match.innings1.history), 2);

  match = applyMatchAction(match, {
    actionId: "undo:wicket",
    type: "undo_last",
  });
  assert.equal(match.score, 4);
  assert.equal(match.outs, 0);
  assert.equal(countLegalBalls(match.innings1.history), 1);

  for (let index = 0; index < 5; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:legal-${index}`,
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
    });
  }

  assert.equal(countLegalBalls(match.innings1.history), 6);

  const advanced = applyMatchAction(match, {
    actionId: "advance:after-over",
    type: "complete_innings",
  });
  assert.equal(advanced.innings, "second");

  const rewound = applyMatchAction(advanced, {
    actionId: "undo:after-advance",
    type: "undo_last",
  });
  assert.equal(rewound.innings, "first");
  assert.equal(countLegalBalls(rewound.innings1.history), 6);
  assert.equal(rewound.score, 9);

  const fixedBall = applyMatchAction(
    applyMatchAction(rewound, {
      actionId: "undo:last-ball",
      type: "undo_last",
    }),
    {
      actionId: "score:replace-last-ball",
      type: "score_ball",
      runs: 4,
      isOut: false,
      extraType: null,
    }
  );

  assert.equal(countLegalBalls(fixedBall.innings1.history), 6);
  assert.equal(fixedBall.score, 12);
});


test("[security] umpire match patching blocks impossible over changes and unsafe roster edits", () => {
  let match = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:patch",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });

  for (let index = 0; index < 12; index += 1) {
    match = applyMatchAction(match, {
      actionId: `score:patch-first-${index}`,
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
    });
  }

  match = applyMatchAction(match, {
    actionId: "advance:patch-second",
    type: "complete_innings",
  });

  assert.throws(
    () => applySafeMatchPatch(match, { overs: 1 }),
    (error) => error instanceof MatchEngineError && error.status === 400
  );

  const oversRaised = applySafeMatchPatch(match, { overs: 3 });
  assert.equal(oversRaised.overs, 3);
  const correctedFirstInnings = applySafeMatchPatch(match, { innings1Score: 9 });
  assert.equal(correctedFirstInnings.innings1.score, 9);
  assert.equal(correctedFirstInnings.score, 0);
  assert.equal(correctedFirstInnings.isOngoing, true);
  assert.equal(correctedFirstInnings.result, "");

  const renamedLockedTeam = applySafeMatchPatch(match, {
    teamAName: "Falcons Prime",
    teamA: ["Alice", "Bea", "Cara"],
  });
  assert.equal(renamedLockedTeam.teamAName, "Falcons Prime");
  assert.equal(renamedLockedTeam.teamA.length, 3);

  assert.throws(
    () =>
      applySafeMatchPatch(match, {
        teamA: ["Alice", "Bea", "Cara", "Dana"],
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );

  const expandedBattingTeam = applySafeMatchPatch(match, {
    teamB: ["Dina", "Esha", "Farah", "Gia"],
  });
  assert.equal(expandedBattingTeam.teamB.length, 4);

  const afterSecondInningsWicket = applyMatchAction(match, {
    actionId: "score:patch-second-wicket",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });
  const afterSecondInningsSecondWicket = applyMatchAction(afterSecondInningsWicket, {
    actionId: "score:patch-second-wicket-2",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });
  const afterSecondInningsBoundary = applyMatchAction(match, {
    actionId: "score:patch-second-boundary",
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
  });
  const correctedWinningTarget = applySafeMatchPatch(afterSecondInningsBoundary, {
    innings1Score: 5,
  });

  assert.equal(correctedWinningTarget.innings1.score, 5);
  assert.equal(correctedWinningTarget.score, 6);
  assert.equal(correctedWinningTarget.isOngoing, false);
  assert.equal(correctedWinningTarget.result, "Titans won by 3 wickets.");
  assert.equal(correctedWinningTarget.lastLiveEvent?.type, "match_end");

  assert.throws(
    () =>
      applySafeMatchPatch(afterSecondInningsSecondWicket, {
        teamB: ["Dina"],
      }),
    (error) => error instanceof MatchEngineError && error.status === 409
  );
});


test("[security] legacy toss-complete matches normalize innings teams and expose tossReady", () => {
  const legacyMatch = {
    ...buildBaseMatch(),
    tossWinner: "Titans",
    tossDecision: "bat",
    innings1: { team: "", score: 0, history: [] },
    innings2: { team: "", score: 0, history: [] },
  };

  const normalized = normalizeLegacyTossState(legacyMatch);
  assert.equal(normalized.innings1.team, "Titans");
  assert.equal(normalized.innings2.team, "Falcons");
  assert.equal(hasCompleteTossState(normalized), true);

  const publicMatch = serializePublicMatch(legacyMatch);
  assert.equal(publicMatch.innings1.team, "Titans");
  assert.equal(publicMatch.innings2.team, "Falcons");
  assert.equal(publicMatch.tossReady, true);
});


test("[security] legacy matches can inherit toss state from the linked session safely", () => {
  const legacyMatch = {
    ...buildBaseMatch(),
    tossWinner: "",
    tossDecision: "",
    innings1: { team: "", score: 0, history: [] },
    innings2: { team: "", score: 0, history: [] },
  };
  const sessionFallback = {
    tossWinner: "Titans",
    tossDecision: "bowl",
  };

  const normalized = normalizeLegacyTossState(legacyMatch, sessionFallback);
  assert.equal(normalized.tossWinner, "Titans");
  assert.equal(normalized.tossDecision, "bowl");
  assert.equal(normalized.innings1.team, "Falcons");
  assert.equal(normalized.innings2.team, "Titans");
  assert.equal(hasCompleteTossState(legacyMatch, sessionFallback), true);
});


test("[security] scoring self-heals legacy toss-complete matches with missing innings teams", () => {
  const legacyMatch = {
    ...buildBaseMatch(),
    tossWinner: "Titans",
    tossDecision: "bat",
    innings1: { team: "", score: 0, history: [] },
    innings2: { team: "", score: 0, history: [] },
  };

  const nextMatch = applyMatchAction(legacyMatch, {
    actionId: "score:legacy-self-heal",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
  });

  assert.equal(nextMatch.innings1.team, "Titans");
  assert.equal(nextMatch.innings2.team, "Falcons");
  assert.equal(nextMatch.score, 1);
  assert.equal(nextMatch.innings1.score, 1);
});


test("[security] started match payload helpers only accept real match ids", () => {
  const nestedPayload = {
    match: {
      _id: "507f1f77bcf86cd799439031",
      teamAName: "Falcons",
    },
  };
  const legacyPayload = {
    _id: "507f1f77bcf86cd799439032",
    teamAName: "Titans",
  };
  const badPayload = {
    match: {
      _id: "session-id-not-a-match",
    },
  };

  assert.equal(getStartedMatchFromPayload(nestedPayload)._id, nestedPayload.match._id);
  assert.equal(getStartedMatchFromPayload(legacyPayload)._id, legacyPayload._id);
  assert.equal(getStartedMatchId(nestedPayload), "507f1f77bcf86cd799439031");
  assert.equal(getStartedMatchId(legacyPayload), "507f1f77bcf86cd799439032");
  assert.equal(getStartedMatchId(badPayload), "");
  assert.equal(getStartedMatchId({}), "");
});
