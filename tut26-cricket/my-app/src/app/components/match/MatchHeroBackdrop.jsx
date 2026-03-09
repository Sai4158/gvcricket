"use client";

import { isSafeMatchImageUrl } from "../../lib/match-image";

export default function MatchHeroBackdrop({ match, children, className = "" }) {
  const imageUrl = match?.matchImageUrl;
  const hasImage = isSafeMatchImageUrl(imageUrl);

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/90 shadow-2xl ${className}`.trim()}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={match?.name || "Match backdrop"}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-30 scale-[1.85] blur-xl sm:scale-[1.65]"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-zinc-950/70 to-zinc-950" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_52%)]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_45%)]" />
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
