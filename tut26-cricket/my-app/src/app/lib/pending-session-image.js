"use client";

const PENDING_SESSION_IMAGE_KEY = "gv-pending-session-image";

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
  const uploadForm = new FormData();
  uploadForm.append("image", file);
  uploadForm.append("draftToken", draftToken);

  const response = await fetch(`/api/sessions/${sessionId}/image`, {
    method: "POST",
    body: uploadForm,
    signal,
  });

  return response.ok;
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

export { PENDING_SESSION_IMAGE_KEY };
