"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: InlineSpinner.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

export default function InlineSpinner({
  className = "",
  size = "sm",
  label = "Loading",
}) {
  const sizeClass =
    size === "xs"
      ? "h-3.5 w-3.5 border-[1.5px]"
      : size === "md"
      ? "h-5 w-5 border-2"
      : "h-4 w-4 border-2";

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label={label}
      role="status"
    >
      <span
        className={`inline-block animate-spin rounded-full border-white/18 border-t-current ${sizeClass}`}
        aria-hidden="true"
      />
    </span>
  );
}


