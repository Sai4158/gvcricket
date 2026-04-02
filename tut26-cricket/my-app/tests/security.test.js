import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  createMatchSchema,
  matchActionSchema,
  sessionCreateSchema,
} from "../src/app/lib/validators.js";
import {
  createMatchAccessToken,
  hasValidMatchAccess,
  isValidManagePin,
  isValidUmpirePin,
} from "../src/app/lib/match-access.js";
import {
  createDirectorAccessToken,
  hasValidDirectorAccess,
  isValidDirectorPin,
} from "../src/app/lib/director-access.js";
import {
  getImagePinCheckPayload,
  getImagePinPromptConfig,
  getRequiredImagePinKind,
  IMAGE_PIN_ATTEMPT_LIMIT,
  IMAGE_PIN_KIND,
} from "../src/app/lib/image-pin-policy.js";
import { PIN_BURST_BLOCK_MS } from "../src/app/lib/pin-attempt-policy.js";
import { enforceSmartPinRateLimit } from "../src/app/lib/pin-attempt-server.js";
import {
  applyMatchAction,
  applySafeMatchPatch,
  MatchEngineError,
} from "../src/app/lib/match-engine.js";
import { validateMatchImageBuffer } from "../src/app/lib/match-image.js";
import { evaluateSensitiveImagePredictions } from "../src/app/lib/match-image-moderation.js";
import {
  GV_MATCH_FALLBACK_IMAGE,
  resolveSafeMatchImage,
} from "../src/app/components/shared/SafeMatchImage.jsx";
import {
  serializePublicMatch,
  serializePublicSession,
} from "../src/app/lib/public-data.js";
import { getTeamBundle } from "../src/app/lib/team-utils.js";
import { applySecurityHeaders } from "../security-headers.mjs";
import { countLegalBalls, buildWinByWicketsText } from "../src/app/lib/match-scoring.js";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildUmpireAnnouncement,
  buildUmpireTapAnnouncement,
  createManualScoreAnnouncementLiveEvent,
  buildSpectatorAnnouncement,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
  createMatchCorrectionLiveEvent,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../src/app/lib/live-announcements.js";
import {
  getStartedMatchId,
  getStartedMatchFromPayload,
} from "../src/app/lib/match-start.js";
import {
  hasCompleteTossState,
  normalizeLegacyTossState,
} from "../src/app/lib/match-toss.js";
import MatchImport from "../src/models/Match.js";
import { HOME_LIVE_BANNER_MATCH_FILTER } from "../src/app/lib/home-live-banner.js";
import {
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  registerWalkieParticipantFromToken,
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

const Match = MatchImport.default || MatchImport;

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

  const normalizedSession = sessionCreateSchema.safeParse({
    name: "Fal\u200Bcons\u202E XI",
    date: "  June\u00A01  ",
  });
  assert.equal(normalizedSession.success, true);
  assert.equal(normalizedSession.data.name, "Fal cons XI");
  assert.equal(normalizedSession.data.date, "June 1");

  const spammySession = sessionCreateSchema.safeParse({
    name: "!!!!!!!!!!",
  });
  assert.equal(spammySession.success, false);

  const sanitizedMatch = createMatchSchema.safeParse({
    sessionId: "507f1f77bcf86cd799439011",
    teamAName: "<b>Team A</b>",
    teamBName: "Team B",
    teamA: ["Ali\u200Bce", "Bea"],
    teamB: ["Cara", "Dina"],
    overs: 6,
  });
  assert.equal(sanitizedMatch.success, true);
  assert.equal(sanitizedMatch.data.teamAName, "Team A");
  assert.equal(sanitizedMatch.data.teamA[0], "Ali ce");

  const invalidAction = matchActionSchema.safeParse({
    actionId: "score:test-action",
    type: "score_ball",
    runs: { $gt: 1 },
    isOut: false,
    extraType: null,
  });
  assert.equal(invalidAction.success, false);
});

test("home live banner match filter stays cast-safe for the Match result field", () => {
  assert.doesNotThrow(() => {
    Match.findOne(HOME_LIVE_BANNER_MATCH_FILTER).cast(Match);
  });
});

test("smart pin rate limit blocks the fourth rapid attempt inside 10 seconds", () => {
  const key = `pin-burst-${crypto.randomBytes(6).toString("hex")}`;
  const baseNow = 1_710_000_000_000;

  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow,
    }).allowed,
    true,
  );
  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow + 1_000,
    }).allowed,
    true,
  );
  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow + 2_000,
    }).allowed,
    true,
  );

  const blockedAttempt = enforceSmartPinRateLimit({
    key,
    longLimit: 10,
    longWindowMs: 60 * 1000,
    longBlockMs: 60 * 1000,
    now: baseNow + 3_000,
  });

  assert.equal(blockedAttempt.allowed, false);
  assert.ok(blockedAttempt.retryAfterMs > 0);
  assert.ok(blockedAttempt.retryAfterMs <= PIN_BURST_BLOCK_MS);
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

test("manage PIN validation supports hashed env configuration", () => {
  const previousSecret = process.env.MATCH_ACCESS_SECRET;
  const previousManageSecret = process.env.SESSION_MANAGE_ACCESS_SECRET;
  const previousManagePin = process.env.SESSION_MANAGE_PIN;
  const previousManagePinHash = process.env.SESSION_MANAGE_PIN_HASH;

  process.env.MATCH_ACCESS_SECRET = "manage-hash-fallback-secret";
  process.env.SESSION_MANAGE_ACCESS_SECRET = "manage-hash-secret";
  process.env.SESSION_MANAGE_PIN = "636363";
  process.env.SESSION_MANAGE_PIN_HASH = crypto
    .scryptSync("636363", "manage-hash-secret", 64)
    .toString("hex");

  try {
    assert.equal(isValidManagePin("636363"), true);
    assert.equal(isValidManagePin("000000"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;

    if (previousManageSecret === undefined) {
      delete process.env.SESSION_MANAGE_ACCESS_SECRET;
    } else {
      process.env.SESSION_MANAGE_ACCESS_SECRET = previousManageSecret;
    }

    if (previousManagePin === undefined) delete process.env.SESSION_MANAGE_PIN;
    else process.env.SESSION_MANAGE_PIN = previousManagePin;

    if (previousManagePinHash === undefined) delete process.env.SESSION_MANAGE_PIN_HASH;
    else process.env.SESSION_MANAGE_PIN_HASH = previousManagePinHash;
  }
});

test("image pin policy keeps first upload on umpire PIN and protects gallery deletes with manage PIN", () => {
  assert.equal(IMAGE_PIN_ATTEMPT_LIMIT, 4);

  assert.equal(
    getRequiredImagePinKind({
      actionType: "upload",
      plannedGalleryCount: 1,
    }),
    IMAGE_PIN_KIND.UMPIRE_OR_MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "upload",
      plannedGalleryCount: 2,
    }),
    IMAGE_PIN_KIND.MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "remove",
      plannedGalleryCount: 1,
    }),
    IMAGE_PIN_KIND.MANAGE
  );
  assert.equal(
    getRequiredImagePinKind({
      actionType: "reorder",
      plannedGalleryCount: 3,
    }),
    IMAGE_PIN_KIND.MANAGE
  );

  assert.deepEqual(
    getImagePinPromptConfig({
      actionType: "upload",
      plannedGalleryCount: 1,
    }),
    {
      pinKind: IMAGE_PIN_KIND.UMPIRE_OR_MANAGE,
      usesManagePin: false,
      digitCount: 4,
      title: "Umpire PIN",
      label: "4-digit PIN",
      placeholder: "0000",
      description: "Enter PIN to upload.",
    }
  );
  assert.deepEqual(
    getImagePinPromptConfig({
      actionType: "remove",
      plannedGalleryCount: 1,
    }),
    {
      pinKind: IMAGE_PIN_KIND.MANAGE,
      usesManagePin: true,
      digitCount: 6,
      title: "Manage PIN",
      label: "Manage PIN",
      placeholder: "- - - - - -",
      description: "Enter manage PIN to remove.",
    }
  );
  assert.deepEqual(
    getImagePinCheckPayload({
      pin: " 636363 ",
      usesManagePin: true,
    }),
    {
      pin: "636363",
      allowUmpirePin: false,
    }
  );
  assert.deepEqual(
    getImagePinCheckPayload({
      pin: "0000",
      usesManagePin: false,
    }),
    {
      pin: "0000",
      allowUmpirePin: true,
    }
  );
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

test("the last remaining batter can continue until the final wicket falls", () => {
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

test("second innings ends immediately when the final wicket falls short of the target", () => {
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

test("second innings ends immediately when the final legal ball completes the chase attempt", () => {
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

test("legacy toss state can be recovered from linked session fallback data", () => {
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

test("umpire scoring combinations undo extras and over completion cleanly", () => {
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

test("umpire match patching blocks impossible over changes and unsafe roster edits", () => {
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

test("legacy toss-complete matches normalize innings teams and expose tossReady", () => {
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

test("legacy matches can inherit toss state from the linked session safely", () => {
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

test("scoring self-heals legacy toss-complete matches with missing innings teams", () => {
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

test("started match payload helpers only accept real match ids", () => {
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

test("image validation rejects invalid binary payloads", () => {
  const fakeExecutable = Buffer.from("MZ-not-an-image");
  const result = validateMatchImageBuffer(fakeExecutable, "image/png");
  assert.equal(result.ok, false);
});

test("match image fallback resolves unsafe or missing images to the GV logo", () => {
  assert.equal(resolveSafeMatchImage(""), GV_MATCH_FALLBACK_IMAGE);
  assert.equal(
    resolveSafeMatchImage("https://example.com/not-allowed.jpg"),
    GV_MATCH_FALLBACK_IMAGE
  );
  assert.equal(
    resolveSafeMatchImage("/api/matches/507f1f77bcf86cd799439011/image/file?v=1"),
    "/api/matches/507f1f77bcf86cd799439011/image/file?v=1"
  );
  assert.equal(
    resolveSafeMatchImage("https://i.ibb.co/demo/sample.jpg"),
    "https://i.ibb.co/demo/sample.jpg"
  );
  assert.equal(
    resolveSafeMatchImage("data:image/jpeg;base64,Zm9vYmFy"),
    "data:image/jpeg;base64,Zm9vYmFy"
  );
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

test("security headers include the required protection policy", () => {
  const headers = applySecurityHeaders(new Headers(), { isProduction: false });
  const contentSecurityPolicy = headers.get("content-security-policy") || "";
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /wss:\/\/\*\.edge\.agora\.io:\*/);
  assert.match(contentSecurityPolicy, /wss:\/\/\*\.edge\.sd-rtn\.com:\*/);
  assert.match(headers.get("permissions-policy"), /camera=\(\)/);
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
  assert.equal(fullLine, "Umpire has given 1 run.");

  const scoreLine = buildSpectatorScoreAnnouncement(event, after);
  assert.equal(scoreLine, "Score is 5 for 2. One ball to finish the over.");

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
  assert.equal(line, "Umpire has given 2 runs.");

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
    "Score is 2 for 0. This is ball 2."
  );

  assert.equal(
    buildSpectatorScoreAnnouncement(ballFourEvent, match),
    "Score is 4 for 0. This is ball 4."
  );
  assert.equal(
    buildSpectatorAnnouncement(undoEvent, match, "full"),
    "Umpire has removed the score for that ball. Umpire will redo this ball."
  );
  assert.equal(buildSpectatorScoreAnnouncement(undoEvent, match), "Score is 4 for 0.");
});

test("manual score announcement event reads the current score without a duplicate lead line", () => {
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

test("score correction announcements stay smart for umpire and spectator", () => {
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

test("umpire commentary speaks score buttons and undo with clean wording", () => {
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

test("umpire tap announcer keeps score-button speech short and direct", () => {
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

test("wide and no-ball extras use given wording in announcer text", () => {
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

test("walkie token-backed participant registration can recover on a fresh route instance", () => {
  const matchId = `walkie-token-${Date.now()}`;
  hydrateWalkieEnabled(matchId, false);

  const snapshot = registerWalkieParticipantFromToken(matchId, {
    id: "spectator-token-user",
    role: "spectator",
    name: "Spectator",
  });

  assert.equal(snapshot.spectatorCount, 1);

  const requestResult = requestWalkieEnable(matchId, {
    participantId: "spectator-token-user",
    role: "spectator",
  });

  assert.equal(requestResult.ok, true);
  assert.equal(requestResult.snapshot.pendingRequests.length, 1);
});
