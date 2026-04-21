"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: SiteFooter.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import Image from "next/image";
import Link from "next/link";
import BackToTopButton from "../home/BackToTopButton";
import HomeScrollFade from "../home/HomeScrollFade";

const footerLinks = [
  {
    href: "/session",
    label: "Live Cricket Scores",
  },
  {
    href: "/session/new",
    label: "Start Cricket Scoring",
  },
  {
    href: "/rules",
    label: "Cricket Scoring Rules",
  },
  {
    href: "/update",
    label: "GV Cricket Updates",
  },
];

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
      <HomeScrollFade
        delayMs={showBackToTop ? 145 : 95}
        className="mb-8"
      >
        <nav aria-label="Popular pages" className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Popular Pages
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300 transition-colors duration-200 hover:border-white/20 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
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


