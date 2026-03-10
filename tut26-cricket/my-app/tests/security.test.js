import assert from "node:assert/strict";
import test from "node:test";
import {
  matchActionSchema,
  sessionCreateSchema,
} from "../src/app/lib/validators.js";
import {
  createMatchAccessToken,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../src/app/lib/match-access.js";
import {
  createDirectorAccessToken,
  hasValidDirectorAccess,
  isValidDirectorPin,
} from "../src/app/lib/director-access.js";
import {
  applyMatchAction,
  MatchEngineError,
} from "../src/app/lib/match-engine.js";
import { validateMatchImageBuffer } from "../src/app/lib/match-image.js";
import { evaluateSensitiveImagePredictions } from "../src/app/lib/match-image-moderation.js";
import {
  serializePublicMatch,
  serializePublicSession,
} from "../src/app/lib/public-data.js";
import { getTeamBundle } from "../src/app/lib/team-utils.js";
import { middleware } from "../middleware.js";
import { countLegalBalls, buildWinByWicketsText } from "../src/app/lib/match-scoring.js";
import {
  buildCurrentScoreAnnouncement,
  buildSpectatorAnnouncement,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
  createScoreLiveEvent,
} from "../src/app/lib/live-announcements.js";
import {
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  requestWalkieEnable,
  respondToWalkieRequest,
  setWalkieEnabled,
} from "../src/app/lib/walkie-talkie.js";

function buildBaseMatch() {
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
  };
}

test("validators reject unknown fields and malformed scoring payloads", () => {
  const invalidSession = sessionCreateSchema.safeParse({
    name: "League Final",
    extra: "nope",
  });
  assert.equal(invalidSession.success, false);

  const sanitizedSession = sessionCreateSchema.safeParse({
    name: "<b>League Final</b>",
    date: "<script>bad()</script>June 1",
  });
  assert.equal(sanitizedSession.success, true);
  assert.equal(sanitizedSession.data.name.includes("<"), false);
  assert.equal(sanitizedSession.data.date.includes("<"), false);

  const invalidAction = matchActionSchema.safeParse({
    actionId: "score:test-action",
    type: "score_ball",
    runs: { $gt: 1 },
    isOut: false,
    extraType: null,
  });
  assert.equal(invalidAction.success, false);
});

test("match access tokens validate by version and PIN checks use constant-time flow", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousPin = process.env.UMPIRE_ADMIN_PIN;
  const previousPinHash = process.env.UMPIRE_ADMIN_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "security-test-secret";
  process.env.UMPIRE_ADMIN_PIN = "0000";
  delete process.env.UMPIRE_ADMIN_PIN_HASH;

  try {
    assert.equal(isValidUmpirePin("0000"), true);
    assert.equal(isValidUmpirePin("1111"), false);

    const token = createMatchAccessToken("match-123", 2);
    assert.equal(hasValidMatchAccess("match-123", token, 2), true);
    assert.equal(hasValidMatchAccess("match-123", token, 1), false);
    assert.equal(hasValidMatchAccess("other-match", token, 2), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousPin === undefined) delete process.env.UMPIRE_ADMIN_PIN;
    else process.env.UMPIRE_ADMIN_PIN = previousPin;

    if (previousPinHash === undefined) delete process.env.UMPIRE_ADMIN_PIN_HASH;
    else process.env.UMPIRE_ADMIN_PIN_HASH = previousPinHash;
  }
});

test("director access tokens validate and director PIN uses the configured secret", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousDirectorPin = process.env.DIRECTOR_CONSOLE_PIN;
  const previousDirectorPinHash = process.env.DIRECTOR_CONSOLE_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "director-test-secret";
  process.env.DIRECTOR_CONSOLE_PIN = "0000";
  delete process.env.DIRECTOR_CONSOLE_PIN_HASH;

  try {
    assert.equal(isValidDirectorPin("0000"), true);
    assert.equal(isValidDirectorPin("1234"), false);

    const token = createDirectorAccessToken();
    assert.equal(hasValidDirectorAccess(token), true);
    const [payload, signature] = token.split(".");
    const tamperedToken = `${payload}.${signature.slice(0, -1)}x`;
    assert.equal(hasValidDirectorAccess(tamperedToken), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousDirectorPin === undefined) delete process.env.DIRECTOR_CONSOLE_PIN;
    else process.env.DIRECTOR_CONSOLE_PIN = previousDirectorPin;

    if (previousDirectorPinHash === undefined) delete process.env.DIRECTOR_CONSOLE_PIN_HASH;
    else process.env.DIRECTOR_CONSOLE_PIN_HASH = previousDirectorPinHash;
  }
});

test("match engine enforces toss-first scoring, undo, and legal innings transitions", () => {
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

test("extras stay legal, do not consume legal balls, and wicket margin stays accurate", () => {
  const afterToss = applyMatchAction(buildBaseMatch(), {
    actionId: "toss:2",
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
  });

  const afterWide = applyMatchAction(afterToss, {
    actionId: "score:wide",
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "wide",
  });
  assert.equal(afterWide.score, 1);
  assert.equal(countLegalBalls(afterWide.innings1.history), 0);

  const afterNoBall = applyMatchAction(afterWide, {
    actionId: "score:noball",
    type: "score_ball",
    runs: 7,
    isOut: false,
    extraType: "noball",
  });
  assert.equal(afterNoBall.score, 8);
  assert.equal(countLegalBalls(afterNoBall.innings1.history), 0);

  assert.throws(
    () =>
      applyMatchAction(afterToss, {
        actionId: "score:bad-extra",
        type: "score_ball",
        runs: 0,
        isOut: false,
        extraType: "wide",
      }),
    (error) => error instanceof MatchEngineError && error.status === 400
  );

  const chaseMatch = {
    ...buildBaseMatch(),
    innings: "second",
    score: 11,
    outs: 1,
    innings1: { team: "Falcons", score: 10, history: [] },
    innings2: { team: "Titans", score: 11, history: [] },
  };
  assert.equal(buildWinByWicketsText(chaseMatch, 1), "Titans won by 1 wicket.");
});

test("full match flow stays accurate across innings change and target chase", () => {
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
  assert.equal(match.result, "Titans won by 2 wickets.");

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

test("legacy rosters still resolve and public serializers hide sensitive fields", () => {
  const legacySession = {
    _id: "507f1f77bcf86cd799439013",
    name: "Old Session",
    date: "",
    teamA: ["Legacy A", "P1", "P2"],
    teamB: ["Legacy B", "Q1", "Q2"],
    match: "507f1f77bcf86cd799439014",
    isLive: true,
    adminAccessVersion: 9,
  };
  const legacyTeam = getTeamBundle(legacySession, "teamA");
  assert.equal(legacyTeam.name, "Legacy A");
  assert.deepEqual(legacyTeam.players, ["P1", "P2"]);

  const publicMatch = serializePublicMatch({
    ...buildBaseMatch(),
    adminAccessVersion: 5,
    processedActionIds: ["a1"],
    actionHistory: [{ actionId: "a1" }],
  });
  assert.equal("adminAccessVersion" in publicMatch, false);
  assert.equal("processedActionIds" in publicMatch, false);
  assert.equal("actionHistory" in publicMatch, false);
  assert.equal(publicMatch.undoCount, 1);

  const publicSession = serializePublicSession(legacySession);
  assert.equal("adminAccessVersion" in publicSession, false);
  assert.equal(publicSession.teamAName, "Legacy A");

  const populatedSession = serializePublicSession({
    ...legacySession,
    match: { _id: "507f1f77bcf86cd799439099" },
  });
  assert.equal(populatedSession.match, "507f1f77bcf86cd799439099");
});

test("image validation rejects invalid binary payloads", () => {
  const fakeExecutable = Buffer.from("MZ-not-an-image");
  const result = validateMatchImageBuffer(fakeExecutable, "image/png");
  assert.equal(result.ok, false);
});

test("sensitive image moderation flags explicit predictions and allows neutral ones", () => {
  const blocked = evaluateSensitiveImagePredictions([
    { className: "Neutral", probability: 0.1 },
    { className: "Porn", probability: 0.91 },
    { className: "Sexy", probability: 0.02 },
  ]);
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.blockedLabels, ["Porn"]);

  const safe = evaluateSensitiveImagePredictions([
    { className: "Neutral", probability: 0.94 },
    { className: "Sexy", probability: 0.18 },
    { className: "Porn", probability: 0.01 },
  ]);
  assert.equal(safe.ok, true);
  assert.deepEqual(safe.blockedLabels, []);
});

test("middleware adds core security headers", () => {
  const response = middleware();
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(response.headers.get("permissions-policy"), /camera=\(\)/);
});

test("spectator commentary uses simple ball-first wording and separate score line", () => {
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

  const fullLine = buildSpectatorAnnouncement(event, after, "full");
  assert.equal(fullLine, "1 run.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.equal(scoreLine, "");

  const currentScoreLine = buildCurrentScoreAnnouncement(after);
  assert.match(currentScoreLine, /Score is 8 for 1\./);
  assert.match(currentScoreLine, /0 overs are done\./);
  assert.match(currentScoreLine, /2 overs are left\./);
  assert.match(currentScoreLine, /3 needed from 1 over and 5 balls\./);
});

test("walkie requests support spectator and director, prevent duplicates, and require umpire response", () => {
  const matchId = `walkie-${Date.now()}`;

  const spectatorRegistration = registerWalkieParticipant(matchId, {
    id: "spectator:test-user",
    role: "spectator",
    name: "North End Spectator",
  });
  const directorRegistration = registerWalkieParticipant(matchId, {
    id: "director:test-user",
    role: "director",
    name: "Director Booth",
  });

  try {
    hydrateWalkieEnabled(matchId, false);

    const spectatorRequest = requestWalkieEnable(matchId, {
      participantId: "spectator:test-user",
      role: "spectator",
    });
    assert.equal(spectatorRequest.ok, true);
    assert.equal(spectatorRequest.snapshot.pendingRequests.length, 1);
    assert.equal(spectatorRequest.snapshot.pendingRequests[0].role, "spectator");

    const duplicateRequest = requestWalkieEnable(matchId, {
      participantId: "spectator:test-user",
      role: "spectator",
    });
    assert.equal(duplicateRequest.ok, false);
    assert.equal(duplicateRequest.status, 409);

    const directorRequest = requestWalkieEnable(matchId, {
      participantId: "director:test-user",
      role: "director",
    });
    assert.equal(directorRequest.ok, true);
    assert.equal(directorRequest.snapshot.pendingRequests.length, 2);

    const dismissed = respondToWalkieRequest(matchId, {
      requestId: directorRequest.snapshot.pendingRequests[1].requestId,
      action: "dismiss",
    });
    assert.equal(dismissed.ok, true);
    assert.equal(dismissed.snapshot.pendingRequests.length, 1);
    assert.equal(dismissed.snapshot.pendingRequests[0].role, "spectator");

    const accepted = respondToWalkieRequest(matchId, {
      requestId: dismissed.snapshot.pendingRequests[0].requestId,
      action: "accept",
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.snapshot.enabled, true);
    assert.equal(accepted.snapshot.pendingRequests.length, 0);
  } finally {
    spectatorRegistration.cleanup();
    directorRegistration.cleanup();
  }
});

test("spectator commentary handles last-ball warnings and over summaries", () => {
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
  assert.equal(fullLine, "1 run.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.equal(scoreLine, "This is the last ball of the over.");

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
  assert.match(overLine, /1 over is done\./);
  assert.match(overLine, /1 over is left\./);
  assert.match(overLine, /1 wicket fell in this over\./);
});

test("target chased announcements congratulate the winner without duplicate score lines", () => {
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
  assert.equal(line, "2 runs.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.match(scoreLine, /Score is 13 for 0\./);
  assert.match(scoreLine, /Match over\./);
  assert.match(scoreLine, /Beta wins by 3 wickets\./);
});

test("spectator commentary gives progress reminders and clean undo lines", () => {
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
    "This is ball 2."
  );

  assert.equal(buildSpectatorScoreAnnouncement(ballFourEvent, match), "This is ball 4.");
  assert.equal(buildSpectatorAnnouncement(undoEvent, match, "full"), "Umpire has undone the last ball.");
});

test("walkie snapshot tracks director presence and spectator requests stay live-only", () => {
  const matchId = `walkie-test-${Date.now()}`;
  hydrateWalkieEnabled(matchId, false);

  const umpire = registerWalkieParticipant(matchId, {
    id: "umpire-1",
    role: "umpire",
    name: "Umpire",
  });
  const director = registerWalkieParticipant(matchId, {
    id: "director-1",
    role: "director",
    name: "Director",
  });
  const spectator = registerWalkieParticipant(matchId, {
    id: "spectator-1",
    role: "spectator",
    name: "Spectator",
  });

  const beforeEnable = getWalkieSnapshot(matchId);
  assert.equal(beforeEnable.directorCount, 1);
  assert.equal(beforeEnable.spectatorCount, 1);
  assert.equal(beforeEnable.umpireCount, 1);
  assert.equal(beforeEnable.enabled, false);

  const requestResult = requestWalkieEnable(matchId, {
    participantId: "spectator-1",
    role: "spectator",
  });
  assert.equal(requestResult.ok, true);
  assert.equal(getWalkieSnapshot(matchId).enabled, false);

  const enabledSnapshot = setWalkieEnabled(matchId, true);
  assert.equal(enabledSnapshot.enabled, true);
  assert.equal(enabledSnapshot.directorCount, 1);

  spectator.cleanup();
  director.cleanup();
  umpire.cleanup();
});
