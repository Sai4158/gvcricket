"use client";

import Image from "next/image";
import { isSafeMatchImageUrl } from "../../lib/match-image";

export default function SessionCoverHero({
  imageUrl = "",
  alt = "Session cover",
  className = "",
  children,
  priority = false,
  tall = false,
}) {
  const hasImage = isSafeMatchImageUrl(imageUrl);

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,12,16,0.98),rgba(5,5,8,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.45)] ${className}`.trim()}
    >
      {hasImage ? (
        <>
          <div className="absolute inset-0">
            <Image
              src={imageUrl}
              alt={alt}
              fill
              priority={priority}
              sizes="(max-width: 768px) 100vw, 1100px"
              className={`object-cover object-center opacity-45 saturate-110 ${tall ? "scale-[1.08]" : "scale-[1.12]"}`}
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(8,8,12,0.54)_38%,rgba(5,5,8,0.82)_72%,rgba(5,5,8,0.96)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,205,96,0.16),transparent_34%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.08),transparent_36%)]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.6)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_34%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.84)_0%,rgba(5,5,8,0.94)_100%)]" />
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,5,8,0.92))]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
