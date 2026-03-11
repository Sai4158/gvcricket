import assert from "node:assert/strict";
import test from "node:test";
import { shouldReceiveWalkieAudio } from "../src/app/components/live/useWalkieTalkie.js";
import {
  createDirectorAccessToken,
  hasValidDirectorAccess,
  isValidDirectorPin,
} from "../src/app/lib/director-access.js";
import {
  claimWalkieSpeaker,
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  releaseWalkieSpeaker,
  requestWalkieEnable,
  respondToWalkieRequest,
  setWalkieEnabled,
} from "../src/app/lib/walkie-talkie.js";

test("director PIN validation trims spaces and rejects invalid characters", () => {
  const previousDirectorPin = process.env.DIRECTOR_CONSOLE_PIN;
  const previousDirectorPinHash = process.env.DIRECTOR_CONSOLE_PIN_HASH;
  const previousSecret = process.env.MATCH_ACCESS_SECRET;

  process.env.DIRECTOR_CONSOLE_PIN = "0000";
  delete process.env.DIRECTOR_CONSOLE_PIN_HASH;
  process.env.MATCH_ACCESS_SECRET = "director-edge-case-secret";

  try {
    assert.equal(isValidDirectorPin("0000"), true);
    assert.equal(isValidDirectorPin(" 0000 "), true);
    assert.equal(isValidDirectorPin("00a0"), false);
    assert.equal(isValidDirectorPin(""), false);

    const token = createDirectorAccessToken();
    assert.equal(hasValidDirectorAccess(token), true);
  } finally {
    if (previousDirectorPin === undefined) delete process.env.DIRECTOR_CONSOLE_PIN;
    else process.env.DIRECTOR_CONSOLE_PIN = previousDirectorPin;

    if (previousDirectorPinHash === undefined)
      delete process.env.DIRECTOR_CONSOLE_PIN_HASH;
    else process.env.DIRECTOR_CONSOLE_PIN_HASH = previousDirectorPinHash;

    if (previousSecret === undefined) delete process.env.MATCH_ACCESS_SECRET;
    else process.env.MATCH_ACCESS_SECRET = previousSecret;
  }
});

test("shared walkie audio lets every non-speaker listen to the active speaker", () => {
  const snapshot = {
    enabled: true,
    activeSpeakerId: "spectator:one",
    activeSpeakerRole: "spectator",
  };

  assert.equal(
    shouldReceiveWalkieAudio({
      participantId: "spectator:one",
      snapshot,
    }),
    false
  );
  assert.equal(
    shouldReceiveWalkieAudio({
      participantId: "spectator:two",
      snapshot,
    }),
    true
  );
  assert.equal(
    shouldReceiveWalkieAudio({
      participantId: "director:one",
      snapshot,
    }),
    true
  );
  assert.equal(
    shouldReceiveWalkieAudio({
      participantId: "umpire:one",
      snapshot,
    }),
    true
  );
});

test("director and spectator can request walkie and umpire must accept or dismiss", () => {
  const matchId = `director-request-${Date.now()}`;
  hydrateWalkieEnabled(matchId, false);

  const umpire = registerWalkieParticipant(matchId, {
    id: "umpire:director-request",
    role: "umpire",
    name: "Lead Umpire",
  });
  const director = registerWalkieParticipant(matchId, {
    id: "director:director-request",
    role: "director",
    name: "Director Booth",
  });
  const spectator = registerWalkieParticipant(matchId, {
    id: "spectator:director-request",
    role: "spectator",
    name: "Spectator One",
  });

  try {
    const directorRequest = requestWalkieEnable(matchId, {
      participantId: "director:director-request",
      role: "director",
    });
    assert.equal(directorRequest.ok, true);
    assert.equal(directorRequest.snapshot.pendingRequests.length, 1);
    assert.equal(directorRequest.snapshot.pendingRequests[0].role, "director");

    const spectatorRequest = requestWalkieEnable(matchId, {
      participantId: "spectator:director-request",
      role: "spectator",
    });
    assert.equal(spectatorRequest.ok, true);
    assert.equal(spectatorRequest.snapshot.pendingRequests.length, 2);

    const dismissed = respondToWalkieRequest(matchId, {
      requestId: directorRequest.snapshot.pendingRequests[0].requestId,
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

    const duplicateAfterEnable = requestWalkieEnable(matchId, {
      participantId: "director:director-request",
      role: "director",
    });
    assert.equal(duplicateAfterEnable.ok, false);
    assert.equal(duplicateAfterEnable.status, 409);
  } finally {
    spectator.cleanup();
    director.cleanup();
    umpire.cleanup();
  }
});

test("walkie lock allows only one active speaker at a time across umpire director spectator", () => {
  const matchId = `director-lock-${Date.now()}`;
  hydrateWalkieEnabled(matchId, true);

  const umpire = registerWalkieParticipant(matchId, {
    id: "umpire:lock",
    role: "umpire",
    name: "Lead Umpire",
  });
  const director = registerWalkieParticipant(matchId, {
    id: "director:lock",
    role: "director",
    name: "Director Booth",
  });
  const spectator = registerWalkieParticipant(matchId, {
    id: "spectator:lock",
    role: "spectator",
    name: "Spectator One",
  });

  try {
    const directorClaim = claimWalkieSpeaker(matchId, {
      participantId: "director:lock",
      role: "director",
    });
    assert.equal(directorClaim.ok, true);
    assert.equal(directorClaim.snapshot.activeSpeakerRole, "director");

    const umpireBlocked = claimWalkieSpeaker(matchId, {
      participantId: "umpire:lock",
      role: "umpire",
    });
    assert.equal(umpireBlocked.ok, false);
    assert.equal(umpireBlocked.status, 409);

    const spectatorBlocked = claimWalkieSpeaker(matchId, {
      participantId: "spectator:lock",
      role: "spectator",
    });
    assert.equal(spectatorBlocked.ok, false);
    assert.equal(spectatorBlocked.status, 409);

    const directorRelease = releaseWalkieSpeaker(matchId, {
      participantId: "director:lock",
    });
    assert.equal(directorRelease.ok, true);
    assert.equal(directorRelease.snapshot.activeSpeakerId, "");

    const umpireClaim = claimWalkieSpeaker(matchId, {
      participantId: "umpire:lock",
      role: "umpire",
    });
    assert.equal(umpireClaim.ok, true);
    assert.equal(umpireClaim.snapshot.activeSpeakerRole, "umpire");
  } finally {
    spectator.cleanup();
    director.cleanup();
    umpire.cleanup();
  }
});

test("disabling walkie clears active speaker state safely", () => {
  const matchId = `director-disable-${Date.now()}`;
  hydrateWalkieEnabled(matchId, true);

  const umpire = registerWalkieParticipant(matchId, {
    id: "umpire:disable",
    role: "umpire",
    name: "Lead Umpire",
  });
  const director = registerWalkieParticipant(matchId, {
    id: "director:disable",
    role: "director",
    name: "Director Booth",
  });

  try {
    const claim = claimWalkieSpeaker(matchId, {
      participantId: "director:disable",
      role: "director",
    });
    assert.equal(claim.ok, true);
    assert.equal(getWalkieSnapshot(matchId).activeSpeakerId, "director:disable");

    const disabled = setWalkieEnabled(matchId, false);
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.activeSpeakerId, "");
    assert.equal(disabled.busy, false);
  } finally {
    director.cleanup();
    umpire.cleanup();
  }
});
