import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyWalkieSignalingSetupError,
  shouldMaintainWalkieAudioTransport,
} from "../src/app/components/live/useWalkieTalkie.js";
import {
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieUiState,
  getNonUmpireWalkieToggleAction,
  NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
  NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
} from "../src/app/lib/walkie-device-state.js";

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

test("walkie audio transport stays on for opted-in passive listening and active talk", () => {
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

test("non-umpire walkie UI state keeps the local-off notice persistent while shared walkie stays live", () => {
  assert.deepEqual(
    getNonUmpireWalkieUiState({
      sharedEnabled: true,
      localEnabled: false,
      isTalking: false,
      isFinishing: false,
    }),
    {
      sharedEnableAnnouncement: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      sharedEnableNotice: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      acceptedAnnouncement: NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
      pendingRequest: false,
      needsLocalEnableNotice: true,
      notice: NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE,
      attentionMode: "flash-pulse",
    }
  );

  assert.deepEqual(
    getNonUmpireWalkieUiState({
      sharedEnabled: true,
      localEnabled: true,
      isTalking: false,
      isFinishing: false,
    }),
    {
      sharedEnableAnnouncement: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      sharedEnableNotice: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      acceptedAnnouncement: NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
      pendingRequest: false,
      needsLocalEnableNotice: false,
      notice: "",
      attentionMode: "idle",
    }
  );

  assert.deepEqual(
    getNonUmpireWalkieUiState({
      sharedEnabled: true,
      localEnabled: false,
      isTalking: true,
      isFinishing: false,
    }),
    {
      sharedEnableAnnouncement: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      sharedEnableNotice: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
      acceptedAnnouncement: NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
      pendingRequest: false,
      needsLocalEnableNotice: false,
      notice: "",
      attentionMode: "idle",
    }
  );
});

test("non-umpire walkie switch uses local enable when shared walkie is live", () => {
  assert.equal(
    getNonUmpireWalkieToggleAction({
      nextChecked: true,
      sharedEnabled: true,
      requestState: "idle",
      hasOwnPendingRequest: false,
    }),
    "enable"
  );

  assert.equal(
    getNonUmpireWalkieToggleAction({
      nextChecked: false,
      sharedEnabled: true,
      requestState: "idle",
      hasOwnPendingRequest: false,
    }),
    "disable"
  );
});

test("non-umpire walkie switch requests umpire approval only while shared walkie is off", () => {
  assert.equal(
    getNonUmpireWalkieToggleAction({
      nextChecked: true,
      sharedEnabled: false,
      requestState: "idle",
      hasOwnPendingRequest: false,
    }),
    "request"
  );

  assert.equal(
    getNonUmpireWalkieToggleAction({
      nextChecked: true,
      sharedEnabled: false,
      requestState: "pending",
      hasOwnPendingRequest: false,
    }),
    "pending"
  );

  assert.equal(
    getNonUmpireWalkieToggleAction({
      nextChecked: true,
      sharedEnabled: false,
      requestState: "idle",
      hasOwnPendingRequest: true,
    }),
    "pending"
  );
});

test("shared umpire walkie transitions fan out enable and reset local non-umpire state", () => {
  assert.equal(
    didSharedWalkieEnable({
      previousSharedEnabled: false,
      sharedEnabled: true,
    }),
    true
  );

  assert.equal(
    didSharedWalkieEnable({
      previousSharedEnabled: true,
      sharedEnabled: true,
    }),
    false
  );

  assert.equal(
    didSharedWalkieDisable({
      previousSharedEnabled: true,
      sharedEnabled: false,
    }),
    true
  );

  assert.equal(
    didSharedWalkieDisable({
      previousSharedEnabled: false,
      sharedEnabled: false,
    }),
    false
  );
});

test("walkie signaling setup classifier ignores stale setup races", () => {
  assert.equal(
    classifyWalkieSignalingSetupError(
      new Error("Walkie signaling changed before setup completed.")
    ),
    "ignore"
  );

  assert.equal(
    classifyWalkieSignalingSetupError(new Error("Walkie is not available.")),
    "ignore"
  );
});

test("walkie signaling setup classifier treats transient RTM churn as recoverable", () => {
  assert.equal(classifyWalkieSignalingSetupError({}), "recoverable");

  assert.equal(
    classifyWalkieSignalingSetupError({
      code: "OPERATION_ABORTED",
      name: "AgoraRTMError",
      message: "WebSocket connection closed during setup.",
    }),
    "recoverable"
  );
});

test("walkie signaling setup classifier keeps real configuration failures fatal", () => {
  assert.equal(
    classifyWalkieSignalingSetupError(new Error("Signaling token missing.")),
    "fatal"
  );

  assert.equal(
    classifyWalkieSignalingSetupError(new Error("Signaling app id missing.")),
    "fatal"
  );

  assert.equal(
    classifyWalkieSignalingSetupError(new Error("Agora signaling is unavailable.")),
    "fatal"
  );
});
