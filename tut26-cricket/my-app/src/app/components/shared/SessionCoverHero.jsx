"use client";


/**
 * File overview:
 * Purpose: UI component for Shared screens and flows.
 * Main exports: SessionCoverHero.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import SafeMatchImage from "./SafeMatchImage";

export default function SessionCoverHero({
  imageUrl = "",
  alt = "Session cover",
  className = "",
  children,
  priority = false,
  tall = false,
  showImage = true,
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,12,16,0.98),rgba(5,5,8,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.45)] ${className}`.trim()}
    >
      {showImage ? (
        <div className="absolute inset-0">
          <SafeMatchImage
            src={imageUrl}
            alt={alt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 1100px"
            className={`object-cover object-center opacity-45 saturate-110 ${tall ? "scale-[1.08]" : "scale-[1.12]"}`}
            fallbackClassName="object-contain object-center p-10 opacity-[0.18] drop-shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
          />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(8,8,12,0.54)_38%,rgba(5,5,8,0.82)_72%,rgba(5,5,8,0.96)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,205,96,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_36%)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.6)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,5,8,0.92))]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
