/**
 * File overview:
 * Purpose: Renders the public landing page for the app.
 * Main exports: RulesPage, metadata.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ../README.md
 */

import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { absoluteUrl, siteConfig } from "../lib/site-metadata";
import { RuleItem, RulesSection } from "../components/rules/RulesSection";
import {
  appGuideIcon,
  appGuideSections,
  ruleSections,
} from "../components/rules/rule-sections";

export const metadata = {
  title: "Cricket Scoring Rules and App Guide",
  description:
    "Read the cricket scoring rules, app guide, and match flow used inside GV Cricket.",
  alternates: {
    canonical: absoluteUrl("/rules"),
  },
  openGraph: {
    title: "Cricket Scoring Rules and App Guide | GV Cricket",
    description:
      "Read the cricket scoring rules, app guide, and match flow used inside GV Cricket.",
    url: absoluteUrl("/rules"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket rules and app guide preview",
      },
    ],
  },
  twitter: {
    title: "Cricket Scoring Rules and App Guide | GV Cricket",
    description:
      "Read the cricket scoring rules, app guide, and match flow used inside GV Cricket.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
};

export default function RulesPage() {
  const AppGuideIcon = appGuideIcon;

  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center bg-zinc-950 text-zinc-200 font-sans">
      <div className="w-full max-w-3xl mb-10 text-center relative">
        <Link
          href="/"
          className="absolute left-0 top-5 -translate-y-1/2 text-sm text-white hover:text-white flex items-center gap-2 transition"
        >
          <FaArrowLeft /> Back
        </Link>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-15">
          GV Cricket Rules
        </h1>
      </div>

      {ruleSections.map((section) => {
        const Icon = section.icon;

        return (
          <RulesSection
            key={section.title}
            icon={<Icon />}
            title={section.title}
            headingColor={section.headingColor}
          >
            {section.items.map((item) => (
              <RuleItem key={item}>{item}</RuleItem>
            ))}
          </RulesSection>
        );
      })}

      <RulesSection
        icon={<AppGuideIcon />}
        title="App Guide"
        headingColor="text-amber-400"
      >
        {appGuideSections.map((section, index) => (
          <div key={section.title}>
            {index > 0 && <br />}
            <h3 className="text-xl font-bold text-white mb-2">{section.title}</h3>
            {section.items.map((item) => (
              <RuleItem key={item}>{item}</RuleItem>
            ))}
          </div>
        ))}
      </RulesSection>

      <div className="text-center pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 mb-5 rounded-xl shadow-lg hover:bg-blue-500 transition-colors"
        >
          <FaArrowLeft />
          Back to Home
        </Link>
        <br />
        <br />
      </div>
    </main>
  );
}


