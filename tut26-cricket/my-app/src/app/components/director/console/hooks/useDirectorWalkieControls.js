/**
 * File overview:
 * Purpose: Encapsulates Director browser state, effects, and runtime coordination.
 * Main exports: useDirectorWalkieControls.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import useWalkieTalkie from "../../../live/useWalkieTalkie";
import {
  didSharedWalkieDisable,
  didSharedWalkieEnable,
  getNonUmpireWalkieToggleAction,
  getNonUmpireWalkieUiState,
  NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
  readWalkieDevicePreference,
  writeWalkieDevicePreference,
} from "../../../../lib/walkie-device-state";
import { getWalkieRemoteSpeakerState } from "../../../../lib/walkie-ui";
import { getDirectorPreferredMatch } from "../director-console-utils";

export default function useDirectorWalkieControls({
  authorized,
  initialDirectorWalkiePreferenceScope = "",
  liveMatch,
  managedSession,
  managedSessionId,
  setDirectorHoldLive,
  speech,
}) {
  const [directorWalkieOn, setDirectorWalkieOn] = useState(() =>
    readWalkieDevicePreference({
      role: "director",
      scopeId: initialDirectorWalkiePreferenceScope,
      fallback: false,
    }),
  );
  const [directorWalkieNotice, setDirectorWalkieNotice] = useState("");

  const previousDirectorWalkieEnabledRef = useRef(false);
  const previousDirectorWalkieRequestStateRef = useRef("idle");
  const directorWalkiePreferenceScopeRef = useRef(
    initialDirectorWalkiePreferenceScope,
  );
  const directorWalkiePreferenceHydratingRef = useRef(false);
  const directorWalkieNoticeTimerRef = useRef(null);

  const showTemporaryDirectorWalkieNotice = useCallback(
    (message, duration = 2600) => {
      setDirectorWalkieNotice(message);
      if (directorWalkieNoticeTimerRef.current) {
        window.clearTimeout(directorWalkieNoticeTimerRef.current);
      }
      directorWalkieNoticeTimerRef.current = window.setTimeout(() => {
        setDirectorWalkieNotice("");
        directorWalkieNoticeTimerRef.current = null;
      }, duration);
    },
    [],
  );

  const scheduleWalkieStateSync = useCallback((callback) => {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(callback);
      return;
    }

    window.setTimeout(callback, 0);
  }, []);

  const directorWalkieMatch = getDirectorPreferredMatch(
    liveMatch,
    managedSession?.match,
  );
  const directorWalkieAvailable = Boolean(
    authorized &&
      managedSession?.match?._id &&
      (directorWalkieMatch?.isOngoing ?? managedSession?.isLive),
  );
  const directorWalkiePreferenceScope =
    managedSession?.match?._id ||
    managedSession?.session?._id ||
    managedSessionId ||
    "";

  useEffect(() => {
    if (!directorWalkiePreferenceScope) {
      directorWalkiePreferenceScopeRef.current = "";
      directorWalkiePreferenceHydratingRef.current = false;
      return;
    }

    if (
      directorWalkiePreferenceScopeRef.current ===
      directorWalkiePreferenceScope
    ) {
      return;
    }

    directorWalkiePreferenceHydratingRef.current = true;
    directorWalkiePreferenceScopeRef.current = directorWalkiePreferenceScope;
    const savedPreference = readWalkieDevicePreference({
      role: "director",
      scopeId: directorWalkiePreferenceScope,
      fallback: false,
    });
    queueMicrotask(() => {
      if (
        directorWalkiePreferenceScopeRef.current ===
        directorWalkiePreferenceScope
      ) {
        setDirectorWalkieOn(savedPreference);
        directorWalkiePreferenceHydratingRef.current = false;
      }
    });
  }, [directorWalkiePreferenceScope]);

  useEffect(() => {
    if (
      !directorWalkiePreferenceScope ||
      directorWalkiePreferenceScopeRef.current !==
        directorWalkiePreferenceScope ||
      directorWalkiePreferenceHydratingRef.current
    ) {
      return;
    }

    writeWalkieDevicePreference({
      role: "director",
      scopeId: directorWalkiePreferenceScope,
      enabled: directorWalkieOn,
    });
  }, [directorWalkieOn, directorWalkiePreferenceScope]);

  const walkie = useWalkieTalkie({
    matchId: managedSession?.match?._id || "",
    enabled: directorWalkieAvailable,
    role: "director",
    displayName: managedSession?.session?.name
      ? `${managedSession.session.name} Director`
      : "Director",
    autoConnectAudio: directorWalkieAvailable && directorWalkieOn,
    signalingActive: directorWalkieAvailable && directorWalkieOn,
  });
  const directorWalkieSharedEnabled = Boolean(walkie.snapshot?.enabled);
  const directorWalkieRequestState = walkie.requestState || "idle";

  const handleDirectorWalkieSwitchChange = useCallback(
    async (nextChecked) => {
      const action = getNonUmpireWalkieToggleAction({
        nextChecked,
        sharedEnabled: directorWalkieSharedEnabled,
        requestState: directorWalkieRequestState,
        hasOwnPendingRequest: walkie.hasOwnPendingRequest,
      });

      if (action === "disable") {
        setDirectorWalkieOn(false);
        await walkie.deactivateAudio();
        return;
      }

      setDirectorWalkieOn(true);

      if (action === "enable") {
        showTemporaryDirectorWalkieNotice("Refreshing walkie signal...", 3200);
        await walkie.refreshSignal?.({ propagate: false });
        return;
      }

      if (action === "pending") {
        showTemporaryDirectorWalkieNotice(
          "Requested umpire access. Waiting for approval.",
          3200,
        );
        return;
      }

      if (!authorized || !managedSession?.match?._id) {
        setDirectorWalkieOn(false);
        return;
      }

      showTemporaryDirectorWalkieNotice("Requesting umpire access...", 3200);
      const requested = await walkie.requestEnable();
      if (!requested) {
        setDirectorWalkieOn(false);
        setDirectorWalkieNotice("");
        return;
      }

      showTemporaryDirectorWalkieNotice(
        "Requested umpire access. Waiting for approval.",
        3200,
      );
    },
    [
      authorized,
      directorWalkieRequestState,
      directorWalkieSharedEnabled,
      managedSession?.match?._id,
      showTemporaryDirectorWalkieNotice,
      walkie,
    ],
  );

  useEffect(() => {
    if (
      didSharedWalkieEnable({
        previousSharedEnabled: previousDirectorWalkieEnabledRef.current,
        sharedEnabled: directorWalkieSharedEnabled,
      })
    ) {
      const sharedEnableMessage =
        walkie.nonUmpireUi?.sharedEnableNotice ||
        NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT;
      scheduleWalkieStateSync(() => {
        showTemporaryDirectorWalkieNotice(sharedEnableMessage, 3600);
      });
      speech.speak(
        walkie.nonUmpireUi?.sharedEnableAnnouncement ||
          NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
        {
          key: `director-walkie-live-${
            managedSession?.match?._id ||
            managedSession?.session?._id ||
            "session"
          }`,
          priority: 4,
          interrupt: true,
          ignoreEnabled: true,
        },
      );
    }

    if (
      didSharedWalkieDisable({
        previousSharedEnabled: previousDirectorWalkieEnabledRef.current,
        sharedEnabled: directorWalkieSharedEnabled,
      })
    ) {
      scheduleWalkieStateSync(() => {
        setDirectorHoldLive(false);
      });
    }

    previousDirectorWalkieEnabledRef.current = directorWalkieSharedEnabled;
  }, [
    directorWalkieSharedEnabled,
    managedSession?.match?._id,
    managedSession?.session?._id,
    scheduleWalkieStateSync,
    setDirectorHoldLive,
    showTemporaryDirectorWalkieNotice,
    speech,
    walkie.nonUmpireUi?.sharedEnableAnnouncement,
    walkie.nonUmpireUi?.sharedEnableNotice,
  ]);

  useEffect(() => {
    if (
      directorWalkieRequestState ===
      previousDirectorWalkieRequestStateRef.current
    ) {
      return;
    }

    previousDirectorWalkieRequestStateRef.current = directorWalkieRequestState;

    if (directorWalkieRequestState === "accepted") {
      scheduleWalkieStateSync(() => {
        setDirectorWalkieOn(true);
      });
      return;
    }

    if (directorWalkieRequestState === "dismissed") {
      scheduleWalkieStateSync(() => {
        setDirectorWalkieOn(false);
      });
    }
  }, [directorWalkieRequestState, scheduleWalkieStateSync]);

  useEffect(() => {
    return () => {
      if (directorWalkieNoticeTimerRef.current) {
        window.clearTimeout(directorWalkieNoticeTimerRef.current);
        directorWalkieNoticeTimerRef.current = null;
      }
    };
  }, []);

  const directorWalkieChannelEnabled = directorWalkieSharedEnabled;
  const directorWalkieUi =
    walkie.nonUmpireUi ||
    getNonUmpireWalkieUiState({
      sharedEnabled: directorWalkieChannelEnabled,
      localEnabled: directorWalkieOn,
      isTalking: walkie.isSelfTalking,
      isFinishing: walkie.isFinishing,
      requestState: walkie.requestState,
      hasOwnPendingRequest: walkie.hasOwnPendingRequest,
    });
  const directorWalkiePending = Boolean(directorWalkieUi.pendingRequest);
  const directorWalkieNeedsLocalEnableNotice = Boolean(
    directorWalkieUi.needsLocalEnableNotice,
  );
  const directorWalkieLoading = Boolean(
    walkie.recoveringAudio ||
      walkie.recoveringSignaling ||
      walkie.updatingEnabled ||
      (!walkie.talkPathPrimed && (walkie.claiming || walkie.preparingToTalk)),
  );
  const directorRemoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot: walkie.snapshot,
    participantId: walkie.participantId,
    isSelfTalking: walkie.isSelfTalking,
  });
  const walkieStatus = directorWalkieLoading
    ? walkie.recoveringAudio || walkie.recoveringSignaling
      ? "Reconnecting"
      : "Connecting"
    : directorRemoteSpeakerState.isRemoteTalking
      ? directorRemoteSpeakerState.shortStatus
      : directorWalkiePending
        ? "Requested"
        : !directorWalkieChannelEnabled
          ? directorWalkieOn
            ? "Standing By"
            : "Off"
          : !directorWalkieOn
            ? "Off"
            : walkie.isFinishing
              ? "Finishing"
              : walkie.isSelfTalking
                ? "Director Live"
                : "Ready";
  const surfacedDirectorWalkieNotice = directorWalkieNeedsLocalEnableNotice
    ? directorWalkieUi.notice
    : directorWalkieChannelEnabled ||
        directorWalkieOn ||
        directorWalkieRequestState === "dismissed"
      ? directorWalkieNotice || walkie.notice
      : "";
  const showDirectorWalkieNotice = Boolean(
    surfacedDirectorWalkieNotice || directorWalkieNeedsLocalEnableNotice,
  );

  return {
    directorRemoteSpeakerState,
    directorWalkieChannelEnabled,
    directorWalkieLoading,
    directorWalkieNeedsLocalEnableNotice,
    directorWalkieNotice,
    directorWalkieOn,
    directorWalkiePending,
    directorWalkieRequestState,
    directorWalkieSharedEnabled,
    directorWalkieUi,
    handleDirectorWalkieSwitchChange,
    setDirectorWalkieNotice,
    setDirectorWalkieOn,
    showDirectorWalkieNotice,
    showTemporaryDirectorWalkieNotice,
    surfacedDirectorWalkieNotice,
    walkie,
    walkieStatus,
  };
}


