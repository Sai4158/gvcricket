"use client";

import { isSafeMatchImageUrl } from "../../lib/match-image";

export default function MatchImageCard({ match, title = "Match Image", compact = false }) {
  const imageUrl = match?.matchImageUrl;

  if (!isSafeMatchImageUrl(imageUrl)) {
    return null;
  }

  return (
    <section className="bg-zinc-900/60 ring-1 ring-white/10 rounded-2xl overflow-hidden shadow-lg">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold">{title}</h3>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={match?.name || "Match"}
        className={`w-full object-cover ${compact ? "max-h-52" : "max-h-80"}`}
        loading="lazy"
      />
    </section>
  );
}
