/**
 * File overview:
 * Purpose: Renders the App Router page entry for Session.
 * Main exports: revalidate, metadata.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Reading guide:
 * - top: imports and page settings
 * - middle: SEO metadata for the session page
 * - bottom: the page function that loads data and renders the client screen
 * Read next: ../README.md
 */

import SessionsPageClient from "../components/session/SessionsPageClient";
import {
  absoluteUrl,
  siteConfig,
  versionedSocialImagePath,
} from "../lib/site-metadata";

// Refresh this page data every 15 seconds.
export const revalidate = 15;

// Page title and social-preview data for /session.
export async function generateMetadata() {
  const shareImageUrl = absoluteUrl(
    versionedSocialImagePath("/session/opengraph-image"),
  );
  const twitterImageUrl = absoluteUrl(
    versionedSocialImagePath("/session/twitter-image"),
  );

  return {
    title: "GV Cricket Latest Games, Live Cricket Scores, and Match Results",
    description:
      "Browse GV Cricket latest games, live cricket scores, completed match results, cricket scoreboards, and saved sessions for local matches, tournaments, and community cricket.",
    keywords: [
      "gv cricket latest games",
      "live cricket scores",
      "latest cricket games",
      "recent cricket matches",
      "cricket match results",
      "cricket scoreboard",
      "cricket live score sessions",
      "free cricket score viewer",
      "cricket scoring",
      "live cricket scoring",
    ],
    alternates: {
      canonical: absoluteUrl("/session"),
    },
    openGraph: {
      title: "GV Cricket Latest Games, Live Scores, and Match Results",
      description:
        "Open GV Cricket latest games, live cricket scoreboards, finished results, and saved sessions in one fast index.",
      url: absoluteUrl("/session"),
      images: [
        {
          url: shareImageUrl,
          width: 1200,
          height: 630,
          alt: "GV Cricket sessions and live score preview",
        },
      ],
    },
    twitter: {
      title: "GV Cricket Latest Games, Live Scores, and Match Results",
      description:
        "Open GV Cricket latest games, live cricket scoreboards, finished results, and saved sessions in one place.",
      images: [
        {
          url: twitterImageUrl,
          alt: "GV Cricket sessions and live score preview",
        },
      ],
    },
  };
}

const sessionsPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "GV Cricket latest games, live cricket scores, and match results",
  url: absoluteUrl("/session"),
  description:
    "Browse GV Cricket latest games, live cricket scores, completed match results, and saved cricket sessions.",
  isPartOf: {
    "@type": "WebSite",
    name: siteConfig.name,
    url: absoluteUrl("/"),
  },
};

// Main session page route.
// This renders the shell immediately and lets the client fetch
// the first sessions page after paint, which keeps first load fast.
export default async function SessionsPage({ searchParams }) {
  // Optional refresh token from the URL, used by the client page when needed.
  const resolvedSearchParams = await searchParams;
  const refreshToken = String(resolvedSearchParams?.refresh || "").trim();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sessionsPageJsonLd) }}
      />
      <SessionsPageClient
        initialPayload={null}
        refreshToken={refreshToken}
      />
    </>
  );
}


