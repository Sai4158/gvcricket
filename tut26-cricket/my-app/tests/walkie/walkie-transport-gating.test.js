/**
 * File overview:
 * Purpose: Covers Walkie Transport Gating.Test behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldMaintainWalkieAudioTransport,
  shouldMaintainWalkieSignaling,
} from "../../src/app/components/live/walkie-talkie-gates.js";
import { mergeWalkieSnapshots } from "../../src/app/components/live/walkie-talkie-state.js";
import {
  classifyWalkieSignalingSetupError,
  isWalkieNetworkError,
} from "../../src/app/components/live/walkie-talkie-support.js";
import {
  buildWalkieDevicePreferenceKey,
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieUiState,
  getNonUmpireWalkieToggleAction,
  NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
  NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
  readWalkieDevicePreference,
  writeWalkieDevicePreference,
} from "../../src/app/lib/walkie-device-state.js";

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("[walkie] walkie audio transport stays off when device walkie is off", () => {
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

test("[walkie] walkie network classifier catches transient browser fetch failures", () => {
  assert.equal(isWalkieNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isWalkieNetworkError(new TypeError("Load failed")), true);
  assert.equal(isWalkieNetworkError(new Error("Request failed")), false);
});

test("[walkie] walkie device preference keeps explicit local on and off memory per scope", () => {
  const previousWindow = global.window;
  global.window = {
    localStorage: createLocalStorageMock(),
  };

  try {
    const spectatorKey = buildWalkieDevicePreferenceKey({
      role: "spectator",
      scopeId: "match-1",
    });

    assert.equal(spectatorKey, "gv-walkie-device-preference-v1:spectator:match-1");
    assert.equal(
      readWalkieDevicePreference({
        role: "spectator",
        scopeId: "match-1",
        fallback: false,
      }),
      false,
    );

    writeWalkieDevicePreference({
      role: "spectator",
      scopeId: "match-1",
      enabled: true,
    });

    assert.equal(
      readWalkieDevicePreference({
        role: "spectator",
        scopeId: "match-1",
        fallback: false,
      }),
      true,
    );

    writeWalkieDevicePreference({
      role: "spectator",
      scopeId: "match-1",
      enabled: false,
    });

    assert.equal(
      readWalkieDevicePreference({
        role: "spectator",
        scopeId: "match-1",
        fallback: true,
      }),
      false,
    );
    assert.equal(
      readWalkieDevicePreference({
        role: "director",
        scopeId: "match-1",
        fallback: false,
      }),
      false,
    );
  } finally {
    global.window = previousWindow;
  }
});

test("[walkie] walkie audio transport stays off when match walkie is disabled", () => {
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

test("[walkie] walkie audio transport stays on only when audio is actually needed", () => {
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

test("[walkie] walkie audio transport stays ready in background only when local walkie listening is enabled", () => {
  assert.equal(
    shouldMaintainWalkieAudioTransport({
      enabled: true,
      snapshot: {
        enabled: true,
        activeSpeakerId: "",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      pageVisible: false,
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
        activeSpeakerId: "remote-user",
      },
      participantId: "self-user",
      hasWalkieToken: true,
      pageVisible: false,
      autoConnectAudio: false,
      manualAudioReady: false,
      isSelfTalking: false,
      isFinishing: false,
    }),
    false
  );
});

test("[walkie] walkie audio transport stays warm for instant push-to-talk when local talk path is armed", () => {
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
      keepReadyForTalk: true,
      manualAudioReady: false,
      isSelfTalking: false,
      isFinishing: false,
    }),
    true
  );
});

test("[walkie] walkie signaling stays off unless the session truly needs a live signaling state", () => {
  assert.equal(
    shouldMaintainWalkieSignaling({
      enabled: true,
      matchId: "match-1",
      pageVisible: true,
      signalingActive: false,
      manualSignalingActive: false,
    }),
    false
  );

  assert.equal(
    shouldMaintainWalkieSignaling({
      enabled: true,
      matchId: "match-1",
      pageVisible: true,
      signalingActive: true,
      manualSignalingActive: false,
    }),
    true
  );

  assert.equal(
    shouldMaintainWalkieSignaling({
      enabled: true,
      matchId: "match-1",
      pageVisible: false,
      signalingActive: true,
      manualSignalingActive: false,
    }),
    true
  );

  assert.equal(
    shouldMaintainWalkieSignaling({
      enabled: true,
      matchId: "match-1",
      pageVisible: false,
      signalingActive: true,
      manualSignalingActive: true,
    }),
    true
  );

  assert.equal(
    shouldMaintainWalkieSignaling({
      enabled: true,
      matchId: "match-1",
      pageVisible: true,
      signalingActive: false,
      manualSignalingActive: true,
    }),
    true
  );
});

test("[walkie] walkie snapshot stays live through transient signaling reconnect cleanup", () => {
  const result = mergeWalkieSnapshots({
    authoritativeSnapshot: {
      enabled: true,
      spectatorCount: 3,
      directorCount: 1,
      umpireCount: 1,
      busy: true,
      activeSpeakerRole: "umpire",
      activeSpeakerId: "umpire-1",
      activeSpeakerName: "Umpire",
      lockStartedAt: "2026-04-01T12:00:00.000Z",
      expiresAt: "2026-04-01T12:00:08.000Z",
      transmissionId: "tx-1",
      pendingRequests: [
        {
          requestId: "req-1",
          participantId: "spectator-1",
          role: "spectator",
          name: "Spectator",
          signalingUserId: "spectator-signal-1",
          requestedAt: "2099-04-01T12:00:00.000Z",
          expiresAt: "2099-04-01T12:00:30.000Z",
        },
      ],
    },
    runtimeSnapshot: {
      enabled: false,
      spectatorCount: 0,
      directorCount: 0,
      umpireCount: 0,
      busy: false,
      activeSpeakerRole: "",
      activeSpeakerId: "",
      activeSpeakerName: "",
      lockStartedAt: "",
      expiresAt: "",
      transmissionId: "",
      pendingRequests: [],
      updatedAt: "",
      version: 0,
    },
    runtimeSubscribed: false,
    runtimePresenceAvailable: false,
    activeSpeakerSource: "runtime",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.activeSpeakerId, "umpire-1");
  assert.equal(result.pendingRequests.length, 1);
  assert.equal(result.spectatorCount, 3);
});

test("[walkie] non-umpire walkie UI state keeps the local-off notice persistent while shared walkie stays live", () => {
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

test("[walkie] non-umpire walkie switch uses local enable when shared walkie is live", () => {
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

test("[walkie] non-umpire walkie switch requests umpire approval only while shared walkie is off", () => {
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

test("[walkie] shared umpire walkie transitions fan out enable and reset local non-umpire state", () => {
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

test("[walkie] walkie signaling setup classifier ignores stale setup races", () => {
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

test("[walkie] walkie signaling setup classifier treats transient RTM churn as recoverable", () => {
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

test("[walkie] walkie signaling setup classifier keeps real configuration failures fatal", () => {
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


