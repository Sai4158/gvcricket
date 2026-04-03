import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMatchAction,
  applySafeMatchPatch,
  buildSessionMirrorUpdate,
} from "../src/app/lib/match-engine.js";
import {
  applyStoredMatchImages,
  createStoredMatchImageEntry,
  rebaseStoredMatchImagesForMatch,
} from "../src/app/lib/match-image-gallery.js";
import { buildSignedMatchImageUrl } from "../src/app/lib/match-image-secure.js";
import { serializePublicMatch, serializePublicSession } from "../src/app/lib/public-data.js";
import {
  claimWalkieSpeaker,
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  requestWalkieEnable,
  respondToWalkieRequest,
  releaseWalkieSpeaker,
} from "../src/app/lib/walkie-talkie.js";

function buildBaseMatch() {
  return {
    _id: "507f1f77bcf86cd799439111",
    teamA: ["Alice", "Bea", "Cara"],
    teamB: ["Dina", "Esha", "Farah"],
    teamAName: "Falcons",
    teamBName: "Titans",
    overs: 2,
    sessionId: "507f1f77bcf86cd799439112",
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
    announcerMode: "full",
    matchImageUrl: "",
    matchImageStorageUrlEnc: "",
    matchImageStorageUrlHash: "",
    matchImagePublicId: "",
    matchImageUploadedAt: null,
    updatedAt: new Date("2026-03-14T12:00:00.000Z"),
  };
}

function actionId(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function setToss(match) {
  return applyMatchAction(match, {
    type: "set_toss",
    tossWinner: "Falcons",
    tossDecision: "bat",
    actionId: actionId("toss"),
  });
}

test("mixed scoring, undo, innings switch, and winning-shot undo stay consistent", () => {
  let match = setToss(buildBaseMatch());

  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: null,
    actionId: actionId("score-1"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: null,
    actionId: actionId("score-2"),
  });
  match = applyMatchAction(match, {
    type: "undo_last",
    actionId: actionId("undo-2"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 4,
    isOut: false,
    extraType: null,
    actionId: actionId("score-4"),
  });

  assert.equal(match.score, 5);
  assert.equal(match.innings1.score, 5);
  assert.equal(match.actionHistory.length, 3);

  match = applySafeMatchPatch(match, {
    teamAName: "Falcons Prime",
    teamBName: "Titans Prime",
    teamA: ["Alice Prime", "Bea Prime", "Cara Prime"],
    teamB: ["Dina Prime", "Esha Prime", "Farah Prime"],
  });

  assert.equal(match.teamAName, "Falcons Prime");
  assert.equal(match.teamBName, "Titans Prime");
  assert.equal(match.innings1.team, "Falcons Prime");
  assert.equal(match.innings2.team, "Titans Prime");

  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "wide",
    actionId: actionId("wide"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 1,
    isOut: false,
    extraType: "noball",
    actionId: actionId("noball"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
    actionId: actionId("wicket"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
    actionId: actionId("finish-first"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
    actionId: actionId("finish-first-wicket-2"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 0,
    isOut: true,
    extraType: null,
    actionId: actionId("finish-first-wicket-3"),
  });
  match = applyMatchAction(match, {
    type: "complete_innings",
    actionId: actionId("complete-first"),
  });

  assert.equal(match.innings, "second");
  assert.equal(match.score, 0);
  assert.equal(match.innings1.score, 13);

  match = applySafeMatchPatch(match, {
    overs: 3,
    teamB: ["Dina Prime", "Esha Prime", "Farah Prime", "Gia Prime"],
  });
  assert.equal(match.overs, 3);
  assert.equal(match.teamB.length, 4);

  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
    actionId: actionId("second-six"),
  });
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 6,
    isOut: false,
    extraType: null,
    actionId: actionId("second-six-2"),
  });
  const winningShot = applyMatchAction(match, {
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: null,
    actionId: actionId("winning-shot"),
  });

  assert.equal(winningShot.result, "Titans Prime won by 4 wickets.");
  assert.equal(winningShot.isOngoing, false);

  const rewound = applyMatchAction(winningShot, {
    type: "undo_last",
    actionId: actionId("undo-winning-shot"),
  });
  assert.equal(rewound.result, "");
  assert.equal(rewound.isOngoing, true);
  assert.equal(rewound.score, 12);

  const finalMatch = applyMatchAction(rewound, {
    type: "score_ball",
    runs: 2,
    isOut: false,
    extraType: "wide",
    actionId: actionId("finish-chase"),
  });
  assert.equal(finalMatch.result, "Titans Prime won by 4 wickets.");
  assert.equal(finalMatch.isOngoing, false);
  assert.equal(finalMatch.score, 14);
});

test("image serialization stays safe during scoring and fallback paths stay stable", () => {
  let match = setToss(buildBaseMatch());
  match = applyMatchAction(match, {
    type: "score_ball",
    runs: 4,
    isOut: false,
    extraType: null,
    actionId: actionId("image-score"),
  });

  const protectedImageMatch = {
    ...match,
    matchImageUrl: "https://i.ibb.co/demo/example.png",
    matchImageStorageUrlHash: "hash-present",
    matchImagePublicId: "public123",
  };
  const protectedImagePublic = serializePublicMatch(protectedImageMatch);
  assert.equal(
    protectedImagePublic.matchImageUrl,
    buildSignedMatchImageUrl(match._id, "public123", "cover")
  );
  assert.equal(protectedImagePublic.score, 4);

  const unsafeLegacyImageMatch = {
    ...match,
    matchImageUrl: "https://evil.example.com/not-allowed.png",
    matchImageStorageUrlHash: "",
    matchImageStorageUrlEnc: "",
    matchImagePublicId: "",
  };
  const unsafeLegacyPublic = serializePublicMatch(unsafeLegacyImageMatch);
  assert.equal(unsafeLegacyPublic.matchImageUrl, "");
  assert.equal(unsafeLegacyPublic.score, 4);
});

test("step-one session image survives draft save, match promotion, and session mirroring", () => {
  const session = {
    _id: "507f1f77bcf86cd799439211",
    match: null,
    name: "Draft Match",
    teamA: [],
    teamB: [],
    teamAName: "",
    teamBName: "",
    overs: 6,
    isLive: false,
    tossWinner: "",
    tossDecision: "",
    matchImages: [],
    matchImageUrl: "",
    matchImagePublicId: "",
    matchImageStorageUrlEnc: "",
    matchImageStorageUrlHash: "",
    matchImageUploadedAt: null,
    matchImageUploadedBy: "",
    updatedAt: new Date("2026-03-14T12:00:00.000Z"),
    createdAt: new Date("2026-03-14T11:00:00.000Z"),
  };

  const draftEntry = createStoredMatchImageEntry({
    matchId: "",
    sourceUrl: "https://i.ibb.co/demo/example.png",
    publicId: "draft-public",
    uploadedAt: new Date("2026-03-14T11:30:00.000Z"),
    uploadedBy: "draft",
    id: "draft-cover",
  });

  applyStoredMatchImages(session, [draftEntry], { matchId: "" });

  const publicSession = serializePublicSession(session);
  assert.equal(publicSession.matchImages.length, 1);
  assert.equal(publicSession.matchImages[0].url, "https://i.ibb.co/demo/example.png");
  assert.equal(publicSession.matchImageUrl, "https://i.ibb.co/demo/example.png");

  const match = {
    ...buildBaseMatch(),
    _id: "507f1f77bcf86cd799439212",
    sessionId: session._id,
  };

  const rebasedImages = rebaseStoredMatchImagesForMatch(
    String(match._id),
    session.matchImages
  );
  applyStoredMatchImages(match, rebasedImages, { matchId: String(match._id) });

  const publicMatch = serializePublicMatch(match, session);
  assert.equal(publicMatch.matchImages.length, 1);
  assert.equal(
    publicMatch.matchImageUrl,
    buildSignedMatchImageUrl(match._id, "draft-public", "draft-cover")
  );

  const sessionMirror = buildSessionMirrorUpdate(match);
  assert.equal(sessionMirror.matchImages.length, 1);
  assert.equal(sessionMirror.matchImagePublicId, "draft-public");
  assert.equal(
    sessionMirror.matchImageUrl,
    buildSignedMatchImageUrl(match._id, "draft-public", "draft-cover")
  );
});

test("public match data falls back to the linked session image until match mirroring catches up", () => {
  const session = {
    _id: "507f1f77bcf86cd799439221",
    match: "507f1f77bcf86cd799439222",
    teamA: [],
    teamB: [],
    teamAName: "Falcons",
    teamBName: "Titans",
    tossWinner: "",
    tossDecision: "",
    matchImages: [],
    matchImageUrl: "",
    matchImagePublicId: "",
    matchImageStorageUrlEnc: "",
    matchImageStorageUrlHash: "",
    matchImageUploadedAt: null,
    matchImageUploadedBy: "",
    updatedAt: new Date("2026-03-14T12:10:00.000Z"),
  };

  const draftEntry = createStoredMatchImageEntry({
    matchId: String(session.match),
    sourceUrl: "https://i.ibb.co/demo/fallback-cover.png",
    publicId: "session-public",
    uploadedAt: new Date("2026-03-14T12:05:00.000Z"),
    uploadedBy: "draft",
    id: "session-cover",
  });

  applyStoredMatchImages(session, [draftEntry], {
    matchId: String(session.match),
  });

  const match = {
    ...buildBaseMatch(),
    _id: "507f1f77bcf86cd799439222",
    sessionId: session._id,
    matchImages: [],
    matchImageUrl: "",
    matchImagePublicId: "",
    matchImageStorageUrlEnc: "",
    matchImageStorageUrlHash: "",
    matchImageUploadedAt: null,
  };

  const publicMatch = serializePublicMatch(match, session);
  assert.equal(publicMatch.matchImages.length, 1);
  assert.equal(
    publicMatch.matchImageUrl,
    buildSignedMatchImageUrl(match._id, "session-public", "session-cover")
  );
});

test("inline draft session images stay visible through promotion into the live match", () => {
  const inlineImageUrl = "data:image/jpeg;base64,Zm9vYmFy";
  const session = {
    _id: "507f1f77bcf86cd799439231",
    match: null,
    name: "Inline Draft Match",
    teamA: [],
    teamB: [],
    teamAName: "",
    teamBName: "",
    overs: 6,
    isLive: false,
    tossWinner: "",
    tossDecision: "",
    matchImages: [],
    matchImageUrl: "",
    matchImagePublicId: "",
    matchImageStorageUrlEnc: "",
    matchImageStorageUrlHash: "",
    matchImageUploadedAt: null,
    matchImageUploadedBy: "",
    updatedAt: new Date("2026-03-14T12:30:00.000Z"),
    createdAt: new Date("2026-03-14T12:00:00.000Z"),
  };

  const inlineEntry = createStoredMatchImageEntry({
    matchId: "",
    sourceUrl: inlineImageUrl,
    publicId: "",
    uploadedAt: new Date("2026-03-14T12:20:00.000Z"),
    uploadedBy: "draft",
    id: "inline-cover",
  });

  applyStoredMatchImages(session, [inlineEntry], { matchId: "" });

  assert.equal(session.matchImageUrl, "");
  assert.equal(session.matchImages[0].url, inlineImageUrl);

  const publicSession = serializePublicSession(session);
  assert.equal(publicSession.matchImageUrl, inlineImageUrl);
  assert.equal(publicSession.matchImages[0].url, inlineImageUrl);

  const match = {
    ...buildBaseMatch(),
    _id: "507f1f77bcf86cd799439232",
    sessionId: session._id,
  };

  const rebasedImages = rebaseStoredMatchImagesForMatch(
    String(match._id),
    session.matchImages
  );
  applyStoredMatchImages(match, rebasedImages, { matchId: String(match._id) });

  assert.equal(match.matchImageUrl, "");
  assert.equal(match.matchImages[0].url, inlineImageUrl);

  const publicMatch = serializePublicMatch(match, session);
  assert.equal(publicMatch.matchImageUrl, inlineImageUrl);
  assert.equal(publicMatch.matchImages[0].url, inlineImageUrl);

  const sessionMirror = buildSessionMirrorUpdate(match);
  assert.equal(sessionMirror.matchImageUrl, "");
  assert.equal(sessionMirror.matchImages[0].url, inlineImageUrl);
});

test("walkie changes stay isolated from score state and do not leak across matches", () => {
  const matchId = `combo-walkie-${Date.now()}`;
  const otherMatchId = `${matchId}-other`;
  let match = setToss(buildBaseMatch());

  hydrateWalkieEnabled(matchId, false);
  hydrateWalkieEnabled(otherMatchId, false);

  const umpire = registerWalkieParticipant(matchId, {
    id: "umpire:combo",
    role: "umpire",
    name: "Lead Umpire",
  });
  const spectator = registerWalkieParticipant(matchId, {
    id: "spectator:combo",
    role: "spectator",
    name: "North End",
  });
  const director = registerWalkieParticipant(matchId, {
    id: "director:combo",
    role: "director",
    name: "Director Booth",
  });

  try {
    const requested = requestWalkieEnable(matchId, {
      participantId: "spectator:combo",
      role: "spectator",
    });
    assert.equal(requested.ok, true);
    assert.equal(requested.snapshot.pendingRequests.length, 1);

    const accepted = respondToWalkieRequest(matchId, {
      requestId: requested.snapshot.pendingRequests[0].requestId,
      action: "accept",
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.snapshot.enabled, true);

    const directorClaim = claimWalkieSpeaker(matchId, {
      participantId: "director:combo",
      role: "director",
    });
    assert.equal(directorClaim.ok, true);
    assert.equal(directorClaim.snapshot.activeSpeakerRole, "director");

    match = applyMatchAction(match, {
      type: "score_ball",
      runs: 1,
      isOut: false,
      extraType: null,
      actionId: actionId("walkie-score"),
    });
    match = applyMatchAction(match, {
      type: "undo_last",
      actionId: actionId("walkie-score-undo"),
    });
    match = applyMatchAction(match, {
      type: "score_ball",
      runs: 6,
      isOut: false,
      extraType: null,
      actionId: actionId("walkie-score-finish"),
    });

    assert.equal(match.score, 6);
    assert.equal(match.innings1.score, 6);
    assert.equal(match.isOngoing, true);

    const activeSnapshot = getWalkieSnapshot(matchId);
    assert.equal(activeSnapshot.enabled, true);
    assert.equal(activeSnapshot.activeSpeakerRole, "director");
    assert.equal(getWalkieSnapshot(otherMatchId).enabled, false);
    assert.equal(getWalkieSnapshot(otherMatchId).activeSpeakerId, "");

    const release = releaseWalkieSpeaker(matchId, {
      participantId: "director:combo",
    });
    assert.equal(release.ok, true);
    assert.equal(getWalkieSnapshot(matchId).activeSpeakerId, "");
  } finally {
    director.cleanup();
    spectator.cleanup();
    umpire.cleanup();
  }
});
