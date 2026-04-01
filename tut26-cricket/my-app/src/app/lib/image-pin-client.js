"use client";

import { getImagePinCheckPayload } from "./image-pin-policy";

export async function verifyImageActionPin({
  pin = "",
  usesManagePin = false,
}) {
  const response = await fetch("/api/media/pin-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      getImagePinCheckPayload({
        pin,
        usesManagePin,
      })
    ),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Incorrect PIN.");
  }

  return true;
}
