"use client";

import { useState } from "react";

function detectAppleMobileSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  const isIOSDevice =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    /Apple/i.test(vendor) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);

  return isIOSDevice && isSafari;
}

export default function useAppleMobileSafari() {
  const [isAppleMobileSafari] = useState(() =>
    detectAppleMobileSafari()
  );

  return isAppleMobileSafari;
}
