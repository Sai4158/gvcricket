"use client";

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
