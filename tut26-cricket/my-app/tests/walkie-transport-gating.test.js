import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldMaintainWalkieAudioTransport,
} from "../src/app/components/live/useWalkieTalkie.js";

test("walkie audio transport stays off when device walkie is off", () => {
  const result = shouldMaintainWalkieAudioTransport({
    enabled: true,
    snapshot: {
      enabled: true,
      activeSpeakerId: "remote-user",
    },
    participantId: "self-user",
    hasWalkieToken: true,
    autoConnectAudio: false,
    manualAudioReady: false,
    isSelfTalking: false,
    isFinishing: false,
  });

  assert.equal(result, false);
});

test("walkie audio transport stays off when match walkie is disabled", () => {
  const result = shouldMaintainWalkieAudioTransport({
    enabled: true,
    snapshot: {
      enabled: false,
      activeSpeakerId: "remote-user",
    },
    participantId: "self-user",
    hasWalkieToken: true,
    autoConnectAudio: true,
    manualAudioReady: true,
    isSelfTalking: false,
    isFinishing: false,
  });

  assert.equal(result, false);
});

test("walkie audio transport stays on for opted-in listening and active talk", () => {
  assert.equal(
    shouldMaintainWalkieAudioTransport({
      enabled: true,
      snapshot: {
        enabled: true,
        activeSpeakerId: "remote-user",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      autoConnectAudio: true,
      manualAudioReady: false,
      isSelfTalking: false,
      isFinishing: false,
    }),
    true
  );

  assert.equal(
    shouldMaintainWalkieAudioTransport({
      enabled: true,
      snapshot: {
        enabled: true,
        activeSpeakerId: "",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      autoConnectAudio: true,
      listeningGraceActive: false,
      manualAudioReady: false,
      isSelfTalking: false,
      isFinishing: false,
    }),
    false
  );

  assert.equal(
    shouldMaintainWalkieAudioTransport({
      enabled: true,
      snapshot: {
        enabled: true,
        activeSpeakerId: "",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      autoConnectAudio: true,
      listeningGraceActive: true,
      manualAudioReady: false,
      isSelfTalking: false,
      isFinishing: false,
    }),
    true
  );

  assert.equal(
    shouldMaintainWalkieAudioTransport({
      enabled: true,
      snapshot: {
        enabled: true,
        activeSpeakerId: "self-user",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      autoConnectAudio: false,
      manualAudioReady: true,
      isSelfTalking: true,
      isFinishing: false,
    }),
    true
  );
});
