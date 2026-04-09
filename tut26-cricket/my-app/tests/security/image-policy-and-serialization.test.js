/**
 * File overview:
 * Purpose: Covers Image Policy And Serialization.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import {
  GV_MATCH_FALLBACK_IMAGE,
  assert,
  buildBaseMatch,
  evaluateSensitiveImagePredictions,
  getTeamBundle,
  resolveSafeMatchImage,
  serializePublicMatch,
  serializePublicSession,
  test,
  validateMatchImageBuffer,
} from "./security-test-helpers.js";

test("[security] legacy rosters still resolve and public serializers hide sensitive fields", () => {
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


test("[security] image validation rejects invalid binary payloads", () => {
  const fakeExecutable = Buffer.from("MZ-not-an-image");
  const result = validateMatchImageBuffer(fakeExecutable, "image/png");
  assert.equal(result.ok, false);
});


test("[security] match image fallback resolves unsafe or missing images to the GV logo", () => {
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


test("[security] sensitive image moderation flags explicit predictions and allows neutral ones", () => {
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


