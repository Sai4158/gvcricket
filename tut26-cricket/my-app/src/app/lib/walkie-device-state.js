export const NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE =
  "Turn on walkie to listen and respond.";
export const NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT =
  "Walkie-talkie is on. Umpire wants to talk. Tap and hold to talk.";
export const NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT =
  "Walkie-talkie accepted. Tap and hold to talk.";

export function didSharedWalkieEnable({
  previousSharedEnabled = false,
  sharedEnabled = false,
} = {}) {
  return Boolean(sharedEnabled && !previousSharedEnabled);
}

export function didSharedWalkieDisable({
  previousSharedEnabled = false,
  sharedEnabled = false,
} = {}) {
  return Boolean(!sharedEnabled && previousSharedEnabled);
}

export function getNonUmpireWalkieToggleAction({
  nextChecked = false,
  sharedEnabled = false,
  requestState = "idle",
  hasOwnPendingRequest = false,
} = {}) {
  if (!nextChecked) {
    return "disable";
  }

  if (sharedEnabled) {
    return "enable";
  }

  if (requestState === "pending" || hasOwnPendingRequest) {
    return "pending";
  }

  return "request";
}

export function getNonUmpireWalkieUiState({
  sharedEnabled = false,
  localEnabled = false,
  isTalking = false,
  isFinishing = false,
  requestState = "idle",
  hasOwnPendingRequest = false,
} = {}) {
  const pendingRequest = Boolean(
    localEnabled &&
      !sharedEnabled &&
      (requestState === "pending" || hasOwnPendingRequest)
  );
  const needsLocalEnableNotice = Boolean(
    sharedEnabled && !localEnabled && !isTalking && !isFinishing
  );

  return {
    sharedEnableAnnouncement: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
    sharedEnableNotice: NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT,
    acceptedAnnouncement: NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT,
    pendingRequest,
    needsLocalEnableNotice,
    notice: needsLocalEnableNotice ? NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE : "",
    attentionMode: needsLocalEnableNotice ? "flash-pulse" : "idle",
  };
}
