/**
 * File overview:
 * Purpose: Covers Walkie Agora Runtime.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgoraWalkieSnapshot,
  filterAgoraWalkieRequests,
  parseAgoraWalkieMetadata,
  removeAgoraWalkieRequest,
  serializeAgoraWalkieMetadata,
  upsertAgoraWalkieRequest,
} from "../../src/app/lib/walkie-agora-runtime.js";

test("[walkie] Agora walkie runtime metadata stays Mongo-free and stable", () => {
  const now = Date.now();
  const requests = filterAgoraWalkieRequests([
    {
      requestId: "req-1",
      participantId: "spec-1",
      role: "spectator",
      name: "Spec One",
      signalingUserId: "agora-user-1",
      requestedAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(),
    },
    {
      requestId: "expired",
      participantId: "spec-2",
      role: "spectator",
      name: "Expired",
      signalingUserId: "agora-user-2",
      requestedAt: new Date(now - 2000).toISOString(),
      expiresAt: new Date(now - 1000).toISOString(),
    },
  ]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].participantId, "spec-1");

  const serialized = serializeAgoraWalkieMetadata({
    enabled: true,
    pendingRequests: requests,
  });

  const parsed = parseAgoraWalkieMetadata({
    walkie_enabled: { value: serialized[0].value },
    walkie_pending_requests: { value: serialized[1].value },
  });

  assert.equal(parsed.enabled, true);
  assert.equal(parsed.pendingRequests.length, 1);
  assert.equal(parsed.pendingRequests[0].signalingUserId, "agora-user-1");
});

test("[walkie] Agora walkie runtime snapshot derives live state from signaling data only", () => {
  const now = Date.now();
  const requests = upsertAgoraWalkieRequest([], {
    requestId: "req-1",
    participantId: "director-1",
    role: "director",
    name: "Director",
    signalingUserId: "director-agora",
    requestedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
  });

  const participants = new Map([
    [
      "umpire-agora",
      {
        participantId: "umpire-1",
        role: "umpire",
        name: "Umpire",
      },
    ],
    [
      "director-agora",
      {
        participantId: "director-1",
        role: "director",
        name: "Director",
      },
    ],
  ]);

  const snapshot = buildAgoraWalkieSnapshot({
    enabled: true,
    pendingRequests: removeAgoraWalkieRequest(requests, "missing"),
    participants,
    activeSpeaker: {
      owner: "umpire-agora",
      participantId: "umpire-1",
      role: "umpire",
      name: "Umpire",
      lockStartedAt: "2026-03-14T00:00:00.000Z",
      expiresAt: "2026-03-14T00:00:35.000Z",
      transmissionId: "agora:umpire-agora:1",
    },
  });

  assert.equal(snapshot.enabled, true);
  assert.equal(snapshot.umpireCount, 1);
  assert.equal(snapshot.directorCount, 1);
  assert.equal(snapshot.activeSpeakerId, "umpire-1");
  assert.equal(snapshot.pendingRequests.length, 1);
});


