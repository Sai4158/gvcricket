/**
 * File overview:
 * Purpose: Covers Live Announcements And Commentary.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import {
  Match,
  applyMatchAction,
  applySafeMatchPatch,
  assert,
  buildBaseMatch,
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildSpectatorAnnouncement,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
  buildUmpireAnnouncement,
  buildUmpireSecondInningsStartSequence,
  buildUmpireStageAnnouncement,
  buildUmpireTapAnnouncement,
  createManualScoreAnnouncementLiveEvent,
  createMatchCorrectionLiveEvent,
  createScoreLiveEvent,
  createUndoLiveEvent,
  test,
} from "./security-test-helpers.js";

test("[security] spectator commentary uses simple ball-first wording and separate score line", () => {
  const before = {
    ...buildBaseMatch(),
    innings: "second",
    score: 7,
    outs: 1,
    innings1: { team: "Falcons", score: 10, history: [] },
    innings2: { team: "Titans", score: 7, history: [] },
  };
  const after = {
    ...before,
    score: 8,
    innings2: {
      team: "Titans",
      score: 8,
      history: [
        {
          overNumber: 1,
          balls: [{ runs: 1, isOut: false, extraType: null }],
        },
      ],
    },
  };
  const event = createScoreLiveEvent(before, after, {
    runs: 1,
    isOut: false,
    extraType: null,
  });
  const dotEvent = createScoreLiveEvent(before, before, {
    runs: 0,
    isOut: false,
    extraType: null,
  });

  const fullLine = buildSpectatorAnnouncement(event, after, "full");
  assert.equal(fullLine, "Umpire has given 1 run.");
  assert.equal(
    buildSpectatorAnnouncement(dotEvent, before, "full"),
    "Umpire has given dot ball.",
  );

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.equal(scoreLine, "Score is 8 for 1.");

  const currentScoreLine = buildCurrentScoreAnnouncement(after);
  assert.match(currentScoreLine, /Score is 8 for 1\./);
  assert.match(currentScoreLine, /Target is 11\./);
  assert.match(currentScoreLine, /5 balls left in this over and 1 over left\./);
});


test("[security] spectator commentary handles last-ball warnings and over summaries", () => {
  const before = {
    ...buildBaseMatch(),
    innings: "first",
    score: 4,
    outs: 2,
    innings1: {
      team: "Falcons",
      score: 4,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 0, isOut: true, extraType: null },
            { runs: 1, isOut: false, extraType: null },
          ],
        },
      ],
    },
  };
  const after = {
    ...before,
    score: 5,
    innings2: {
      ...before.innings2,
    },
    innings1: {
      team: "Falcons",
      score: 5,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 0, isOut: true, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
          ],
        },
      ],
    },
  };

  const event = createScoreLiveEvent(before, after, {
    runs: 1,
    isOut: false,
    extraType: null,
  });

  const fullLine = buildSpectatorAnnouncement(event, after, "full");
  assert.equal(fullLine, "Umpire has given 1 run.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.equal(scoreLine, "Score is 5 for 2. One ball left.");

  const overLine = buildSpectatorOverCompleteAnnouncement({
    ...after,
    score: 6,
    outs: 2,
    innings1: {
      team: "Falcons",
      score: 6,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 0, isOut: true, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 2, isOut: false, extraType: null },
          ],
        },
      ],
    },
  });
  assert.match(overLine, /Over complete\./);
  assert.match(overLine, /Score is 6 for 2\./);
  assert.match(overLine, /1 over completed\./);
  assert.match(overLine, /1 over is left\./);
  assert.match(overLine, /1 wicket fell in this over\./);
});


test("[security] target chased announcements congratulate the winner without duplicate score lines", () => {
  const before = {
    ...buildBaseMatch(),
    innings: "second",
    teamAName: "Alpha",
    teamBName: "Beta",
    score: 11,
    outs: 0,
    innings1: { team: "Alpha", score: 12, history: [] },
    innings2: {
      team: "Beta",
      score: 11,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 2, isOut: false, extraType: null },
            { runs: 4, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
          ],
        },
      ],
    },
  };

  const after = {
    ...before,
    score: 13,
    result: "Beta won by 3 wickets.",
    innings2: {
      team: "Beta",
      score: 13,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 2, isOut: false, extraType: null },
            { runs: 4, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 2, isOut: false, extraType: null },
          ],
        },
      ],
    },
    isOngoing: false,
  };

  const event = createScoreLiveEvent(before, after, {
    runs: 2,
    isOut: false,
    extraType: null,
  });

  const line = buildSpectatorAnnouncement(event, after, "full");
  assert.equal(line, "Umpire has given 2 runs.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.match(scoreLine, /Score is 13 for 0\./);
  assert.match(scoreLine, /Match over\./);
  assert.match(scoreLine, /Beta wins by 3 wickets\./);
});


test("[security] spectator commentary gives progress reminders and clean undo lines", () => {
  const match = {
    ...buildBaseMatch(),
    score: 4,
    outs: 0,
    innings1: {
      team: "Falcons",
      score: 4,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 2, isOut: false, extraType: null },
            { runs: 0, isOut: false, extraType: null },
          ],
        },
      ],
    },
  };

  const ballTwoEvent = {
    id: "evt-ball-2",
    type: "score_update",
    ball: { runs: 1, isOut: false, extraType: null },
    score: 2,
    outs: 0,
    overCompleted: false,
  };
  const ballFourEvent = {
    id: "evt-ball-4",
    type: "score_update",
    ball: { runs: 0, isOut: false, extraType: null },
    score: 4,
    outs: 0,
    overCompleted: false,
  };
  const undoEvent = {
    id: "evt-undo",
    type: "undo",
    score: 4,
    outs: 0,
  };

  assert.equal(
    buildSpectatorScoreAnnouncement(ballTwoEvent, {
      ...match,
      innings1: {
        ...match.innings1,
        history: [
          {
            overNumber: 1,
            balls: [
              { runs: 1, isOut: false, extraType: null },
              { runs: 1, isOut: false, extraType: null },
            ],
          },
        ],
      },
    }),
    "Score is 2 for 0. Ball 2 completed."
  );

  assert.equal(
    buildSpectatorScoreAnnouncement(ballFourEvent, match),
    "Score is 4 for 0. Ball 4 completed."
  );
  assert.equal(
    buildSpectatorAnnouncement(undoEvent, match, "full"),
    "Umpire has removed the score for that ball. Umpire will redo this ball."
  );
  assert.equal(buildSpectatorScoreAnnouncement(undoEvent, match), "Score is 4 for 0.");
});


test("[security] manual score announcement event reads the current score without a duplicate lead line", () => {
  const match = {
    ...buildBaseMatch(),
    tossWinner: "Falcons",
    tossDecision: "bat",
    innings: "first",
    score: 42,
    outs: 2,
    innings1: {
      team: "Falcons",
      score: 42,
      outs: 2,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1 },
            { runs: 2 },
            { runs: 0 },
            { runs: 4 },
            { runs: 1 },
            { runs: 0 },
          ],
        },
      ],
    },
    innings2: { team: "Titans", score: 0, history: [] },
  };

  const event = createManualScoreAnnouncementLiveEvent(match);
  const sequence = buildLiveScoreAnnouncementSequence(event, match, "full");

  assert.equal(buildSpectatorAnnouncement(event, match, "full"), "");
  assert.equal(sequence.items.length, 1);
  assert.match(sequence.items[0].text, /Score is 42 for 2\./);
});


test("[security] score correction announcements stay smart for umpire and spectator", () => {
  const firstInnings = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:correction-flow",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });
  const singleOverMatch = applySafeMatchPatch(firstInnings, { overs: 1 });
  const firstInningsComplete = [
    { actionId: "score:first-1", type: "score_ball", runs: 1, isOut: false, extraType: null },
    { actionId: "score:first-2", type: "score_ball", runs: 1, isOut: false, extraType: null },
    { actionId: "score:first-3", type: "score_ball", runs: 1, isOut: false, extraType: null },
    { actionId: "score:first-4", type: "score_ball", runs: 1, isOut: false, extraType: null },
    { actionId: "score:first-5", type: "score_ball", runs: 1, isOut: false, extraType: null },
    { actionId: "score:first-6", type: "score_ball", runs: 0, isOut: false, extraType: null },
  ].reduce((nextMatch, action) => applyMatchAction(nextMatch, action), singleOverMatch);
  const secondInnings = applyMatchAction(firstInningsComplete, {
    actionId: "advance:to-second",
    type: "complete_innings",
  });
  const chaseMatch = applyMatchAction(secondInnings, {
    actionId: "score:second-1",
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: null,
  });

  const correctedMatch = applySafeMatchPatch(chaseMatch, {
    innings1Score: 6,
  });
  const correctionEvent = createMatchCorrectionLiveEvent(chaseMatch, correctedMatch, {
    innings1Score: 6,
  });

  assert.equal(
    buildSpectatorAnnouncement(correctionEvent, correctedMatch, "full"),
    "Umpire corrected the first innings score."
  );
  assert.equal(
    buildSpectatorScoreAnnouncement(correctionEvent, correctedMatch),
    "Score is 2 for 0. Target is now 7. 5 needed from 5 balls."
  );
});

test("[security] spectator progress reminders prefer the event ball number over a newer match state", () => {
  const staleEvent = {
    id: "evt-ball-2-stable",
    type: "score_update",
    ball: { runs: 1, isOut: false, extraType: null },
    score: 2,
    outs: 0,
    overCompleted: false,
    ballNumberInOver: 2,
  };

  const newerMatchState = {
    ...buildBaseMatch(),
    score: 3,
    outs: 0,
    innings1: {
      team: "Falcons",
      score: 3,
      history: [
        {
          overNumber: 1,
          balls: [
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
            { runs: 1, isOut: false, extraType: null },
          ],
        },
      ],
    },
  };

  assert.equal(
    buildSpectatorScoreAnnouncement(staleEvent, newerMatchState),
    "Score is 2 for 0. Ball 2 completed."
  );
});

test("[security] roster size corrections announce equal and split team sizes cleanly", () => {
  const baseMatch = buildBaseMatch();

  const equalSizedMatch = applySafeMatchPatch(baseMatch, {
    teamA: ["Alice", "Bea", "Cara", "Dana"],
    teamB: ["Dina", "Esha", "Farah", "Gia"],
  });
  const equalSizedEvent = createMatchCorrectionLiveEvent(baseMatch, equalSizedMatch, {
    teamA: ["Alice", "Bea", "Cara", "Dana"],
    teamB: ["Dina", "Esha", "Farah", "Gia"],
  });

  assert.equal(
    buildSpectatorAnnouncement(equalSizedEvent, equalSizedMatch, "full"),
    "Both teams now have 4 players."
  );

  const unevenSizedMatch = applySafeMatchPatch(baseMatch, {
    teamA: ["Alice", "Bea", "Cara", "Dana", "Eli"],
    teamB: ["Dina", "Esha", "Farah", "Gia"],
  });
  const unevenSizedEvent = createMatchCorrectionLiveEvent(baseMatch, unevenSizedMatch, {
    teamA: ["Alice", "Bea", "Cara", "Dana", "Eli"],
    teamB: ["Dina", "Esha", "Farah", "Gia"],
  });

  assert.equal(
    buildSpectatorAnnouncement(unevenSizedEvent, unevenSizedMatch, "full"),
    "Falcons now have 5 players. Titans now have 4 players."
  );
});


test("[security] umpire commentary speaks score buttons and undo with clean wording", () => {
  const matchBefore = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:umpire-audio",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });
  const matchAfter = applyMatchAction(matchBefore, {
    actionId: "score:umpire-audio",
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: null,
  });

  const scoreEvent = createScoreLiveEvent(matchBefore, matchAfter, {
    runs: 2,
    isOut: false,
    extraType: null,
  });
  const dotBallEvent = createScoreLiveEvent(matchBefore, matchBefore, {
    runs: 0,
    isOut: false,
    extraType: null,
  });
  const undoEvent = createUndoLiveEvent(matchAfter);

  assert.equal(
    buildUmpireAnnouncement(scoreEvent, "simple"),
    "Umpire has given 2 runs."
  );
  assert.equal(
    buildUmpireAnnouncement(dotBallEvent, "simple"),
    "Umpire has given dot ball."
  );
  assert.equal(
    buildUmpireAnnouncement(undoEvent, "simple"),
    "Umpire has removed the score for that ball. Umpire will redo this ball."
  );
});


test("[security] umpire tap announcer keeps score-button speech short and direct", () => {
  const matchBefore = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:umpire-tap-audio",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });
  const twoRunsAfter = applyMatchAction(matchBefore, {
    actionId: "score:umpire-tap-two",
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: null,
  });
  const twoRunsEvent = createScoreLiveEvent(matchBefore, twoRunsAfter, {
    runs: 2,
    isOut: false,
    extraType: null,
  });
  const dotBallEvent = createScoreLiveEvent(matchBefore, matchBefore, {
    runs: 0,
    isOut: false,
    extraType: null,
  });
  const outAfter = applyMatchAction(matchBefore, {
    actionId: "score:umpire-tap-out",
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
  });
  const outEvent = createScoreLiveEvent(matchBefore, outAfter, {
    runs: 0,
    isOut: true,
    extraType: null,
  });
  const undoEvent = createUndoLiveEvent(twoRunsAfter);

  assert.equal(buildUmpireTapAnnouncement(twoRunsEvent, "simple"), "2 runs.");
  assert.equal(buildUmpireTapAnnouncement(dotBallEvent, "simple"), "Dot ball.");
  assert.equal(buildUmpireTapAnnouncement(outEvent, "simple"), "Out.");
  assert.equal(buildUmpireTapAnnouncement(undoEvent, "simple"), "Undo.");
});


test("[security] umpire stage announcer covers innings break and final result copy", () => {
  const inningsBreakMatch = {
    ...buildBaseMatch(),
    innings: "first",
    score: 48,
    outs: 3,
    innings1: {
      team: "AGGAM",
      score: 48,
      outs: 3,
      history: [],
    },
    innings2: {
      team: "TEAM RED",
      score: 0,
      outs: 0,
      history: [],
    },
    result: "",
  };

  assert.equal(
    buildUmpireStageAnnouncement(inningsBreakMatch),
    "First innings complete. Aggam posted 48 for 3. Target is 49. Team Red need 49 to win. Required rate is 24 point 5 runs per over. Good luck, Aggam and Team Red."
  );

  const matchOver = {
    ...inningsBreakMatch,
    innings: "second",
    score: 50,
    outs: 4,
    result: "TEAM RED won by 2 wickets.",
  };

  assert.equal(
    buildUmpireStageAnnouncement(matchOver),
    "Match over. Congratulations Team Red. Team Red won by 2 wickets. Final score is 50 for 4."
  );
});


test("[security] spectator innings-change speech stays in sync with team-aware stage copy", () => {
  const match = {
    ...buildBaseMatch(),
    innings: "second",
    score: 0,
    outs: 0,
    overs: 2,
    innings1: {
      team: "AGGAM",
      score: 26,
      outs: 3,
      history: [],
    },
    innings2: {
      team: "TEAM RED",
      score: 0,
      outs: 0,
      history: [],
    },
  };
  const event = {
    id: "evt-innings-change",
    type: "innings_change",
  };

  assert.equal(
    buildSpectatorAnnouncement(event, match, "full"),
    "First innings complete. Aggam posted 26 for 3.",
  );
  assert.equal(
    buildSpectatorScoreAnnouncement(event, match),
    "Target is 27. Team Red need 27 to win. Required rate is 13 point 5 runs per over. Good luck, Aggam and Team Red.",
  );
});


test("[security] second innings start sequence announces target, rate, and team names", () => {
  const secondInningsMatch = {
    ...buildBaseMatch(),
    innings: "second",
    score: 0,
    outs: 0,
    innings1: {
      team: "TEAM BLUE",
      score: 42,
      outs: 3,
      history: [],
    },
    innings2: {
      team: "AGGAM",
      score: 0,
      outs: 0,
      history: [],
    },
    overs: 4,
    result: "",
  };

  const sequence = buildUmpireSecondInningsStartSequence(secondInningsMatch);

  assert.equal(sequence.priority, 4);
  assert.deepEqual(
    sequence.items.map((item) => item.text),
    [
      "Second innings starts now.",
      "Team Blue posted 42 for 3.",
      "Target is 43. Aggam need 43 to win. Required rate is 10 point 75 runs per over.",
      "Good luck, Team Blue and Aggam.",
    ]
  );
});


test("[security] second innings start sequence avoids awkward zero-zero rate speech", () => {
  const secondInningsMatch = {
    ...buildBaseMatch(),
    innings: "second",
    score: 0,
    outs: 0,
    innings1: {
      team: "Team Blue",
      score: 0,
      outs: 0,
      history: [],
    },
    innings2: {
      team: "Team Red",
      score: 0,
      outs: 0,
      history: [],
    },
    overs: 12,
    result: "",
  };

  const sequence = buildUmpireSecondInningsStartSequence(secondInningsMatch);

  assert.equal(
    sequence.items[2]?.text,
    "Target is 1. Team Red need 1 to win. Required rate is under 1 run per over.",
  );
});


test("[security] wide and no-ball extras use given wording in announcer text", () => {
  const matchBefore = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:extras-given-wording",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });
  const wideAfter = applyMatchAction(matchBefore, {
    actionId: "score:wide-given-wording",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "wide",
  });
  const noBallAfter = applyMatchAction(matchBefore, {
    actionId: "score:noball-given-wording",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "noball",
  });
  const wideEvent = createScoreLiveEvent(matchBefore, wideAfter, {
    runs: 1,
    isOut: false,
    extraType: "wide",
  });
  const noBallEvent = createScoreLiveEvent(matchBefore, noBallAfter, {
    runs: 1,
    isOut: false,
    extraType: "noball",
  });

  assert.equal(
    buildSpectatorAnnouncement(wideEvent, wideAfter, "simple"),
    "Umpire has given a wide. 1 run given."
  );
  assert.equal(
    buildSpectatorAnnouncement(noBallEvent, noBallAfter, "simple"),
    "Umpire has given a no ball. 1 run given."
  );
  assert.equal(
    buildUmpireAnnouncement(wideEvent, "simple"),
    "Umpire has given a wide. 1 run given."
  );
  assert.equal(
    buildUmpireAnnouncement(noBallEvent, "simple"),
    "Umpire has given a no ball. 1 run given."
  );
  assert.equal(buildUmpireTapAnnouncement(wideEvent, "simple"), "Wide, 1 run given.");
  assert.equal(
    buildUmpireTapAnnouncement(noBallEvent, "simple"),
    "No ball, 1 run given."
  );
});


