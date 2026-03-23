import nextDynamic from "next/dynamic";
import Image from "next/image";
import BackToTopButton from "./components/home/BackToTopButton";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";

const HowItWorksSection = nextDynamic(() => import("./components/home/HowItWorksSection"), { ssr: true });
const CommunityHighlightsSection = nextDynamic(() => import("./components/home/CommunityHighlightsSection"), { ssr: true });
const LearnCricketCard = nextDynamic(() => import("./components/home/LearnCricketCard"), { ssr: true });

export const revalidate = 86400;

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
  return (
    <>
      <HomeHeader />
      <main id="top" className="home-liquid-surface overflow-x-hidden bg-black text-zinc-200 font-sans">
        <HeroSection />
        <div className="relative z-10 space-y-14 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] px-5 py-20 md:space-y-24 md:py-28 xl:px-8 xl:py-24 xl:space-y-20 2xl:px-10 2xl:py-28">
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
              GV Cricket brings live score, umpire mode, spectator view, director controls, walkie-talkie, and results into one fast mobile flow.
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
