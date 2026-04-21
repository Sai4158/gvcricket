/**
 * File overview:
 * Purpose: Renders the public landing page for the app.
 * Main exports: metadata.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ./README.md
 */

import nextDynamic from "next/dynamic";
import HeroSection from "./components/home/HeroSection";
import HomeHeader from "./components/home/HomeHeader";
import HomeSeoSection, { faqItems } from "./components/home/HomeSeoSection";
import PrimaryActionsSection from "./components/home/PrimaryActionsSection";
import SiteFooter from "./components/shared/SiteFooter";
import { absoluteUrl, siteConfig } from "./lib/site-metadata";

const HowItWorksSection = nextDynamic(() => import("./components/home/HowItWorksSection"), { ssr: true });
const CommunityHighlightsSection = nextDynamic(() => import("./components/home/CommunityHighlightsSection"), { ssr: true });
const LearnCricketCard = nextDynamic(() => import("./components/home/LearnCricketCard"), { ssr: true });

export const metadata = {
  title: "GV Cricket | Free Live Cricket Scoring App, Umpire Mode, Scoreboard",
  description:
    "Free live cricket scoring app for local matches, leagues, tournaments, school cricket, box cricket, and tennis-ball cricket with umpire mode, spectator scoreboards, and instant results for cricket communities in India, Pakistan, Bangladesh, Sri Lanka, Nepal, UAE, and more.",
  keywords: siteConfig.keywords,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "GV Cricket | Free Live Cricket Scoring App and Match Control",
    description:
      "Free live cricket scoring with umpire mode, spectator scoreboards, instant results, and mobile-first match control for local cricket communities.",
    url: absoluteUrl("/"),
    type: "website",
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
    card: "summary_large_image",
    title: "GV Cricket | Free Live Cricket Scoring App and Match Control",
    description:
      "Free live cricket scoring app for local matches, tournaments, and spectators with fast umpire mode and instant results.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
};

const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <main id="top" className="home-liquid-surface overflow-x-hidden bg-black text-zinc-200 font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
        />
        <HeroSection />
        <div className="relative z-10 space-y-14 bg-[linear-gradient(155deg,var(--color-red-900)_0%,var(--color-black)_40%)] px-5 py-20 md:space-y-24 md:py-28 xl:space-y-20 xl:px-8 xl:py-24 2xl:px-10 2xl:py-28">
          <PrimaryActionsSection />
          <HowItWorksSection />
          <CommunityHighlightsSection />
          <LearnCricketCard />
          <HomeSeoSection />
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
