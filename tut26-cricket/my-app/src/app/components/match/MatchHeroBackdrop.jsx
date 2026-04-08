"use client";


/**
 * File overview:
 * Purpose: UI component for Match screens and flows.
 * Main exports: MatchHeroBackdrop.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import SessionCoverHero from "../shared/SessionCoverHero";

export default function MatchHeroBackdrop({ match, children, className = "" }) {
  return (
    <SessionCoverHero
      imageUrl={match?.matchImageUrl || ""}
      alt={match?.name || "Match cover"}
      className={className}
      priority
      tall
    >
      {children}
    </SessionCoverHero>
  );
}
