"use client";

/**
 * File overview:
 * Purpose: Renders Home UI for the app's screens and flows.
 * Main exports: BackToTopButton.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { FaArrowUp } from "react-icons/fa";

export default function BackToTopButton() {
  const handleBackToTop = () => {
    const topElement = document.getElementById("top");
    if (topElement) {
      topElement.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleBackToTop}
      className="liquid-glass home-md-no-glass inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-sm text-zinc-200 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-white/20 hover:text-white"
      aria-label="Back to top"
    >
      <FaArrowUp className="text-sm" />
    </button>
  );
}


