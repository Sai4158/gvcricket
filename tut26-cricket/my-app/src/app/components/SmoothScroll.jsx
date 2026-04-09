/**
 * File overview:
 * Purpose: Wraps app content with Lenis-based smooth scrolling for client-rendered pages.
 * Main exports: default export.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

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

