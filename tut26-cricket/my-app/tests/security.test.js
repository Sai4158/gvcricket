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
  applyMatchAction,
  MatchEngineError,
} from "../src/app/lib/match-engine.js";
import { validateMatchImageBuffer } from "../src/app/lib/match-image.js";
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
  createScoreLiveEvent,
} from "../src/app/lib/live-announcements.js";

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
  process.env.UMPIRE_ADMIN_PIN = "000000";
  delete process.env.UMPIRE_ADMIN_PIN_HASH;

  try {
    assert.equal(isValidUmpirePin("000000"), true);
    assert.equal(isValidUmpirePin("111111"), false);

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

test("middleware adds core security headers", () => {
  const response = middleware();
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(response.headers.get("permissions-policy"), /camera=\(\)/);
});

test("spectator commentary includes smart score and chase details", () => {
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
  assert.match(fullLine, /Titans batting\./);
  assert.match(fullLine, /Current score, 8 for 1 after 0\.1 overs\./);
  assert.match(fullLine, /Need 3 from 11 with 1 wicket in hand\./);

  const currentScoreLine = buildCurrentScoreAnnouncement(after);
  assert.match(currentScoreLine, /Titans batting\./);
  assert.match(currentScoreLine, /Current score, 8 for 1 after 0\.1 overs\./);
});
