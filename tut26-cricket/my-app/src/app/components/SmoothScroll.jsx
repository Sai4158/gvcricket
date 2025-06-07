// src/components/SmoothScroll.jsx
"use client";
import { ReactLenis } from "@studio-freight/react-lenis";

function SmoothScroll({ children }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}

export default SmoothScroll;
