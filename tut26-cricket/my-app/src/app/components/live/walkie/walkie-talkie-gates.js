/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: shouldReceiveWalkieAudio, shouldPlayWalkieRemoteAudio, shouldMaintainWalkieAudioTransport, shouldMaintainWalkieSignaling.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { EMPTY_WALKIE_SNAPSHOT } from "./walkie-talkie-state";

export function shouldReceiveWalkieAudio({
  participantId = "",
  snapshot = EMPTY_WALKIE_SNAPSHOT,
} = {}) {
  if (!snapshot?.enabled) {
    return false;
  }

  const activeSpeakerId = snapshot.activeSpeakerId || "";
  if (!activeSpeakerId) {
    return false;
  }

  return activeSpeakerId !== participantId;
}

export function shouldPlayWalkieRemoteAudio({
  participantId = "",
  snapshot = EMPTY_WALKIE_SNAPSHOT,
  isSelfTalking = false,
  isFinishing = false,
} = {}) {
  if (isSelfTalking || isFinishing) {
    return false;
  }

  return shouldReceiveWalkieAudio({ participantId, snapshot });
}

export function shouldMaintainWalkieAudioTransport({
  enabled = false,
  snapshot = EMPTY_WALKIE_SNAPSHOT,
  participantId = "",
  hasWalkieToken = false,
  pageVisible = true,
  autoConnectAudio = false,
  listeningGraceActive = false,
  manualAudioReady = false,
  isSelfTalking = false,
  isFinishing = false,
  keepReadyForTalk = false,
} = {}) {
  if (
    !enabled ||
    !snapshot?.enabled ||
    !participantId ||
    !hasWalkieToken
  ) {
    return false;
  }
  const remoteSpeakerActive = shouldReceiveWalkieAudio({ participantId, snapshot });
  if (manualAudioReady || isSelfTalking || isFinishing) {
    return true;
  }
  if (keepReadyForTalk) {
    return true;
  }
  if (!pageVisible && autoConnectAudio) {
    return true;
  }
  if (!pageVisible && !autoConnectAudio && !remoteSpeakerActive && !listeningGraceActive) {
    return false;
  }
  if (autoConnectAudio && remoteSpeakerActive) {
    return true;
  }
  if (listeningGraceActive) {
    return true;
  }
  return false;
}

export function shouldMaintainWalkieSignaling({
  enabled = false,
  matchId = "",
  signalingActive = false,
  manualSignalingActive = false,
} = {}) {
  return Boolean(
    enabled &&
      matchId &&
      (manualSignalingActive || signalingActive)
  );
}


