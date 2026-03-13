import CommunityHighlightsSection from "./components/home/CommunityHighlightsSection";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import HowItWorksSection from "./components/home/HowItWorksSection";
import LearnCricketCard from "./components/home/LearnCricketCard";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";
import { loadHomeLiveBannerData } from "./lib/server-data";

export const metadata = {
  title: "Free Cricket Scoring, Made Simple",
  description:
    "Free cricket scoring app with live score updates, umpire mode, spectator view, score announcer, walkie-talkie, and match results in one fast mobile-friendly flow.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Free Cricket Scoring, Made Simple | GV Cricket",
    description:
      "Score every match from toss to result with live updates, umpire mode, spectator view, score announcer, and built-in walkie-talkie.",
    url: absoluteUrl("/"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket free cricket scoring app preview",
      },
    ],
  },
  twitter: {
    title: "Free Cricket Scoring, Made Simple | GV Cricket",
    description:
      "Live cricket score, umpire mode, spectator view, score announcer, walkie-talkie, and results in one free app.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
};

export default async function HomePage() {
  let liveMatch = null;

  try {
    liveMatch = await loadHomeLiveBannerData();
  } catch (error) {
    console.error("Home live banner load failed:", error);
  }

  return (
    <>
      <HomeHeader />
      <main className="home-liquid-surface bg-black text-zinc-200 font-sans">
        <HeroSection liveMatch={liveMatch} />
        <div className="relative z-10 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] px-5 py-20 space-y-14 md:space-y-24 md:py-28">
          <PrimaryActionsSection />
          <HowItWorksSection />
          <CommunityHighlightsSection />
          <LearnCricketCard />
          <footer className="text-center pt-24 pb-12 border-t border-white/10">
            <p className="text-zinc-400">
              &copy; {new Date().getFullYear()} GV Cricket. All rights reserved.
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Free cricket scoring app for live score, umpire mode, spectator view, walkie-talkie, and match results.
            </p>
            <a
              href="https://gvcricket.com"
              className="mt-2 inline-block text-zinc-400 transition-colors duration-200 hover:text-zinc-200"
            >
              gvcricket.com
            </a>
          </footer>
        </div>
      </main>
    </>
  );
}
