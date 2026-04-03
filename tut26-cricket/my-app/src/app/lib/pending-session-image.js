"use client";

const PENDING_SESSION_IMAGE_KEY = "gv-pending-session-image";

export function getPendingSessionImageNoticeKey(sessionId) {
  const safeSessionId = String(sessionId || "").trim();
  return safeSessionId ? `session_${safeSessionId}_imageUploadNotice` : "";
}

export function getPendingSessionImage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawPendingImage = window.sessionStorage.getItem(PENDING_SESSION_IMAGE_KEY);
    return rawPendingImage ? JSON.parse(rawPendingImage) : null;
  } catch {
    return null;
  }
}

export function clearPendingSessionImage() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_SESSION_IMAGE_KEY);
}

export function getPendingSessionImageNotice(sessionId) {
  if (typeof window === "undefined") {
    return "";
  }

  const noticeKey = getPendingSessionImageNoticeKey(sessionId);
  if (!noticeKey) {
    return "";
  }

  try {
    return window.sessionStorage.getItem(noticeKey) || "";
  } catch {
    return "";
  }
}

export function setPendingSessionImageNotice(sessionId, message) {
  if (typeof window === "undefined") {
    return;
  }

  const noticeKey = getPendingSessionImageNoticeKey(sessionId);
  if (!noticeKey) {
    return;
  }

  const trimmedMessage = String(message || "").trim();
  try {
    if (!trimmedMessage) {
      window.sessionStorage.removeItem(noticeKey);
      return;
    }

    window.sessionStorage.setItem(noticeKey, trimmedMessage);
  } catch {
    // Non-critical UI notice only.
  }
}

export function clearPendingSessionImageNotice(sessionId) {
  if (typeof window === "undefined") {
    return;
  }

  const noticeKey = getPendingSessionImageNoticeKey(sessionId);
  if (!noticeKey) {
    return;
  }

  try {
    window.sessionStorage.removeItem(noticeKey);
  } catch {
    // Non-critical UI notice only.
  }
}

async function createPendingImageFile(pendingImage, signal) {
  const imageResponse = await fetch(pendingImage.dataUrl, { signal });
  const imageBlob = await imageResponse.blob();

  return new File(
    [imageBlob],
    pendingImage.fileName || "session-cover.jpg",
    {
      type: pendingImage.type || imageBlob.type || "image/jpeg",
    }
  );
}

async function postDraftSessionImage({
  sessionId,
  draftToken,
  file,
  signal,
}) {
  const uploadForm = new FormData();
  uploadForm.append("image", file);
  uploadForm.append("draftToken", draftToken);

  return fetch(`/api/sessions/${sessionId}/image`, {
    method: "POST",
    body: uploadForm,
    signal,
  });
}

export async function uploadSessionImageFileToDraftSession({
  sessionId,
  draftToken,
  file,
  signal,
}) {
  if (!(file instanceof File) || !sessionId || !draftToken) {
    throw new Error("Choose a match image first.");
  }

  const response = await postDraftSessionImage({
    sessionId,
    draftToken,
    file,
    signal,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to upload the session image.");
  }

  return payload;
}

export async function uploadPendingSessionImageToDraftSession({
  sessionId,
  draftToken,
  pendingImage,
  signal,
}) {
  if (!pendingImage?.dataUrl || !sessionId || !draftToken) {
    return false;
  }

  const file = await createPendingImageFile(pendingImage, signal);
  const response = await postDraftSessionImage({
    sessionId,
    draftToken,
    file,
    signal,
  });

  return response.ok;
}

export async function uploadStoredPendingSessionImageToDraftSession({
  sessionId,
  draftToken,
  signal,
}) {
  const pendingImage = getPendingSessionImage();
  if (!pendingImage?.dataUrl || !sessionId || !draftToken) {
    return false;
  }

  const didUpload = await uploadPendingSessionImageToDraftSession({
    sessionId,
    draftToken,
    pendingImage,
    signal,
  });

  if (didUpload) {
    clearPendingSessionImage();
  }

  return didUpload;
}

export async function uploadPendingSessionImageToMatch({
  matchId,
  pendingImage,
  signal,
}) {
  if (!pendingImage?.dataUrl || !matchId) {
    return false;
  }

  const file = await createPendingImageFile(pendingImage, signal);
  const uploadForm = new FormData();
  uploadForm.append("image", file);

  const response = await fetch(`/api/matches/${matchId}/image`, {
    method: "POST",
    body: uploadForm,
    signal,
  });

  return response.ok;
}

export async function uploadStoredPendingSessionImageToMatch({
  matchId,
  signal,
}) {
  const pendingImage = getPendingSessionImage();
  if (!pendingImage?.dataUrl || !matchId) {
    return false;
  }

  const didUpload = await uploadPendingSessionImageToMatch({
    matchId,
    pendingImage,
    signal,
  });

  if (didUpload) {
    clearPendingSessionImage();
  }

  return didUpload;
}

export { PENDING_SESSION_IMAGE_KEY };
