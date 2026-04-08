"use client";


/**
 * File overview:
 * Purpose: UI component for Match screens and flows.
 * Main exports: MatchImageCard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import SafeMatchImage from "../shared/SafeMatchImage";

export default function MatchImageCard({ match, title = "Match Image", compact = false }) {
  const imageUrl = match?.matchImageUrl || "";

  return (
    <section className="bg-zinc-900/60 ring-1 ring-white/10 rounded-2xl overflow-hidden shadow-lg">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold">{title}</h3>
      </div>
      <SafeMatchImage
        src={imageUrl}
        alt={match?.name || "Match"}
        width={1200}
        height={720}
        className={`w-full object-cover ${compact ? "max-h-52" : "max-h-80"}`}
        fallbackClassName={`w-full object-contain bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))] p-8 ${compact ? "max-h-52" : "max-h-80"}`}
        sizes="(max-width: 768px) 100vw, 800px"
      />
    </section>
  );
}
