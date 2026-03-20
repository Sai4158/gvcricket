// src/components/SmoothScroll.jsx
"use client";
import { ReactLenis } from "lenis/react";
import { useEffect } from "react";
import useAppleMobileSafari from "../lib/useAppleMobileSafari";

function SmoothScroll({ children }) {
  const isAppleMobileSafari = useAppleMobileSafari();

  useEffect(() => {
    const root = document.documentElement;

    if (isAppleMobileSafari) {
      root.dataset.appleMobileSafari = "true";
      return;
    }

    delete root.dataset.appleMobileSafari;
  }, [isAppleMobileSafari]);

  if (isAppleMobileSafari) {
    return children;
  }

  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}

export default SmoothScroll;
