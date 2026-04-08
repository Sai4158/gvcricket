/**
 * File overview:
 * Purpose: Walkie request, snapshot, and token-backed participant regression coverage.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import {
  assert,
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  registerWalkieParticipantFromToken,
  requestWalkieEnable,
  respondToWalkieRequest,
  setWalkieEnabled,
  test,
} from "./security-test-helpers.js";

test("[security] walkie requests support spectator and director, prevent duplicates, and require umpire response", () => {
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


test("[security] walkie snapshot tracks director presence and spectator requests stay live-only", () => {
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


test("[security] walkie token-backed participant registration can recover on a fresh route instance", () => {
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
