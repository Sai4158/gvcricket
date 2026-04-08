"use client";


/**
 * File overview:
 * Purpose: UI component for Shared screens and flows.
 * Main exports: SiteFooter.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import Image from "next/image";
import BackToTopButton from "../home/BackToTopButton";
import HomeScrollFade from "../home/HomeScrollFade";

export default function SiteFooter({
  action = null,
  className = "",
  showBackToTop = true,
}) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`mx-auto w-full max-w-4xl border-t border-white/10 pt-14 pb-12 text-center ${className}`.trim()}
    >
      {action ? <div className="mb-8 flex justify-center">{action}</div> : null}
      {showBackToTop ? (
        <HomeScrollFade delayMs={20} className="mb-6 flex justify-center">
          <BackToTopButton />
        </HomeScrollFade>
      ) : null}
      <HomeScrollFade
        delayMs={showBackToTop ? 70 : 20}
        className="mx-auto mb-8 h-px w-full max-w-4xl bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.9),rgba(255,255,255,0.06))]"
      >
        <span className="sr-only">Footer divider</span>
      </HomeScrollFade>
      <HomeScrollFade
        delayMs={showBackToTop ? 120 : 70}
        className="mb-8 flex justify-center"
      >
        <Image
          src="/gvLogo.png"
          alt="GV Cricket logo"
          width={220}
          height={220}
          priority={false}
          unoptimized
          className="h-auto w-[150px] object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.42)] sm:w-[180px]"
        />
      </HomeScrollFade>
      <HomeScrollFade delayMs={showBackToTop ? 170 : 120}>
        <p suppressHydrationWarning className="text-zinc-400">
          &copy; {currentYear} GV Cricket. All rights reserved.
        </p>
      </HomeScrollFade>
      <HomeScrollFade delayMs={showBackToTop ? 220 : 170}>
        <p className="mt-2 text-sm text-zinc-500">
          GV Cricket brings live score, umpire mode, spectator view, director controls, walkie-talkie, and results into one fast mobile flow.
        </p>
      </HomeScrollFade>
      <HomeScrollFade delayMs={showBackToTop ? 270 : 220}>
        <a
          href="https://gvcricket.com"
          className="mt-2 inline-block text-zinc-400 transition-colors duration-200 hover:text-zinc-200"
        >
          gvcricket.com
        </a>
      </HomeScrollFade>
    </footer>
  );
}
