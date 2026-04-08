/**
 * File overview:
 * Purpose: Shared helper module for Image Pin Policy logic.
 * Main exports: getRequiredImagePinKind, getImagePinPromptConfig, getImagePinCheckPayload, IMAGE_PIN_ATTEMPT_LIMIT, IMAGE_PIN_ATTEMPT_WINDOW_MS, IMAGE_PIN_ATTEMPT_BLOCK_MS, IMAGE_PIN_KIND.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
export const IMAGE_PIN_ATTEMPT_LIMIT = 4;
export const IMAGE_PIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
export const IMAGE_PIN_ATTEMPT_BLOCK_MS = 2 * 60 * 1000;

export const IMAGE_PIN_KIND = {
  UMPIRE_OR_MANAGE: "umpire-or-manage",
  MANAGE: "manage",
};

function isManagePinKind(pinKind) {
  return pinKind === IMAGE_PIN_KIND.MANAGE;
}

export function getRequiredImagePinKind({
  actionType = "",
  plannedGalleryCount = 0,
}) {
  if (actionType === "remove" || actionType === "reorder") {
    return IMAGE_PIN_KIND.MANAGE;
  }

  return Number(plannedGalleryCount || 0) > 1
    ? IMAGE_PIN_KIND.MANAGE
    : IMAGE_PIN_KIND.UMPIRE_OR_MANAGE;
}

export function getImagePinPromptConfig({
  actionType = "",
  plannedGalleryCount = 0,
}) {
  const pinKind = getRequiredImagePinKind({
    actionType,
    plannedGalleryCount,
  });
  const usesManagePin = isManagePinKind(pinKind);

  let description = "Enter PIN to upload.";
  if (actionType === "remove") {
    description = "Enter manage PIN to remove.";
  } else if (actionType === "reorder") {
    description = "Enter manage PIN to save order.";
  } else if (usesManagePin) {
    description = "Enter manage PIN to upload.";
  }

  return {
    pinKind,
    usesManagePin,
    digitCount: usesManagePin ? 6 : 4,
    title: usesManagePin ? "Manage PIN" : "Umpire PIN",
    label: usesManagePin ? "Manage PIN" : "4-digit PIN",
    placeholder: usesManagePin ? "- - - - - -" : "0000",
    description,
  };
}

export function getImagePinCheckPayload({
  pin = "",
  usesManagePin = false,
}) {
  return {
    pin: String(pin || "").trim(),
    allowUmpirePin: !usesManagePin,
  };
}
