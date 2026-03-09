"use client";

import CommunityHighlightsSection from "./components/home/CommunityHighlightsSection";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import HowItWorksSection from "./components/home/HowItWorksSection";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <main className="bg-black text-zinc-200 font-sans">
        <HeroSection />
        <div className="relative z-10 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] py-24 md:py-32 px-5 space-y-24 md:space-y-40">
          <PrimaryActionsSection />
          <HowItWorksSection />
          <CommunityHighlightsSection />
          <footer className="text-center pt-24 pb-12 border-t border-white/10">
            <p className="text-zinc-400">
              &copy; {new Date().getFullYear()} GV Cricket. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
