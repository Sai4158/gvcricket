export const NON_UMPIRE_WALKIE_LOCAL_ENABLE_NOTICE =
  "Turn on walkie to listen and respond.";
export const NON_UMPIRE_WALKIE_SHARED_ENABLE_ANNOUNCEMENT =
  "Walkie-talkie is on. Tap and hold to talk.";
export const NON_UMPIRE_WALKIE_ACCEPTED_ANNOUNCEMENT =
  "Walkie-talkie accepted. Tap and hold to talk.";
const WALKIE_DEVICE_PREFERENCE_STORAGE_PREFIX = "gv-walkie-device-preference-v1";

export function buildWalkieDevicePreferenceKey({
  role = "",
  scopeId = "",
} = {}) {
  const normalizedRole = String(role || "").trim();
  const normalizedScopeId = String(scopeId || "").trim();

  if (!normalizedRole || !normalizedScopeId) {
    return "";
  }

  return `${WALKIE_DEVICE_PREFERENCE_STORAGE_PREFIX}:${normalizedRole}:${normalizedScopeId}`;
}

export function readWalkieDevicePreference({
  role = "",
  scopeId = "",
  fallback = false,
} = {}) {
  if (typeof window === "undefined") {
    return Boolean(fallback);
  }

  const key = buildWalkieDevicePreferenceKey({ role, scopeId });
  if (!key) {
    return Boolean(fallback);
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      return Boolean(fallback);
    }

    if (rawValue === "1" || rawValue === "true") {
      return true;
    }

    if (rawValue === "0" || rawValue === "false") {
      return false;
    }
  } catch {
    return Boolean(fallback);
  }

  return Boolean(fallback);
}

export function writeWalkieDevicePreference({
  role = "",
  scopeId = "",
  enabled = false,
} = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const key = buildWalkieDevicePreferenceKey({ role, scopeId });
  if (!key) {
    return;
  }

  try {
    window.localStorage.setItem(key, enabled ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

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
