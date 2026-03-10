import CommunityHighlightsSection from "./components/home/CommunityHighlightsSection";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import HowItWorksSection from "./components/home/HowItWorksSection";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import { loadHomeLiveBannerData } from "./lib/server-data";

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
      <main className="bg-black text-zinc-200 font-sans">
        <HeroSection liveMatch={liveMatch} />
        <div className="relative z-10 bg-[radial-gradient(circle_at_top,rgba(180,83,9,0.14),transparent_28%),linear-gradient(160deg,#08080b_0%,#0d0d12_42%,#050507_100%)] py-24 md:py-32 px-5 space-y-24 md:space-y-40">
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
