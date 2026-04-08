/**
 * File overview:
 * Purpose: UI component for SmoothScroll screens and flows.
 * Main exports: default export.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
// src/components/SmoothScroll.jsx
"use client";
import { ReactLenis } from "lenis/react";

function SmoothScroll({ children }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}

export default SmoothScroll;
