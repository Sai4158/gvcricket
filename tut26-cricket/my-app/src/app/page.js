import Image from "next/image";
import CommunityHighlightsSection from "./components/home/CommunityHighlightsSection";
import BackToTopButton from "./components/home/BackToTopButton";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import HowItWorksSection from "./components/home/HowItWorksSection";
import LearnCricketCard from "./components/home/LearnCricketCard";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";
import { loadHomeLiveBannerData } from "./lib/server-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    title: "GV Cricket",
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
      <main id="top" className="home-liquid-surface overflow-x-hidden bg-black text-zinc-200 font-sans">
        <HeroSection liveMatch={liveMatch} />
        <div className="relative z-10 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] px-5 py-20 space-y-14 md:space-y-24 md:py-28">
          <PrimaryActionsSection />
          <HowItWorksSection />
          <CommunityHighlightsSection />
          <LearnCricketCard />
          <footer className="border-t border-white/10 pt-14 pb-12 text-center">
            <div className="mb-6 flex justify-center">
              <BackToTopButton />
            </div>
            <div className="mx-auto mb-8 h-px w-full max-w-4xl bg-[linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.9),rgba(255,255,255,0.06))]" />
            <div className="mb-8 flex justify-center">
              <Image
                src="/gvLogo.png"
                alt="GV Cricket logo"
                width={220}
                height={220}
                priority={false}
                className="h-auto w-[150px] object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.42)] sm:w-[180px]"
              />
            </div>
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
