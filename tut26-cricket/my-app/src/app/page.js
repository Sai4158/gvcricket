/**
 * File overview:
 * Purpose: Renders the public landing page for the app.
 * Main exports: dynamic, metadata.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ./README.md
 */

import nextDynamic from "next/dynamic";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import SiteFooter from "./components/shared/SiteFooter";
import { loadHomeLiveBannerData } from "./lib/server-data";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";

const HowItWorksSection = nextDynamic(() => import("./components/home/HowItWorksSection"), { ssr: true });
const CommunityHighlightsSection = nextDynamic(() => import("./components/home/CommunityHighlightsSection"), { ssr: true });
const LearnCricketCard = nextDynamic(() => import("./components/home/LearnCricketCard"), { ssr: true });

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GV Cricket | Live Cricket Scoring, Umpire Mode, Match Control",
  description:
    "Score every match from toss to result with live score, umpire mode, spectator view, director controls, walkie-talkie, loudspeaker, match images, and final results in one fast mobile flow.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "GV Cricket | Live Cricket Scoring, Umpire Mode, Match Control",
    description:
      "Live cricket scoring with umpire mode, spectator scoreboards, director controls, walkie-talkie, loudspeaker, match images, and instant results.",
    url: absoluteUrl("/"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket live cricket scoring preview",
      },
    ],
  },
  twitter: {
    title: "GV Cricket | Live Cricket Scoring, Umpire Mode, Match Control",
    description:
      "Live cricket scoring with umpire mode, spectator scoreboards, director controls, walkie-talkie, loudspeaker, match images, and final results.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
};

export default async function HomePage() {
  const liveMatch = await loadHomeLiveBannerData();

  return (
    <>
      <HomeHeader />
      <main id="top" className="home-liquid-surface overflow-x-hidden bg-black text-zinc-200 font-sans">
        <HeroSection liveMatch={liveMatch} />
        <div className="relative z-10 space-y-14 bg-[linear-gradient(155deg,var(--color-red-900)_0%,var(--color-black)_40%)] px-5 py-20 md:space-y-24 md:py-28 xl:space-y-20 xl:px-8 xl:py-24 2xl:px-10 2xl:py-28">
          <PrimaryActionsSection />
          <HowItWorksSection />
          <CommunityHighlightsSection />
          <LearnCricketCard />
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
