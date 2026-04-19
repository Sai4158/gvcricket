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
import { absoluteUrl, siteConfig } from "../lib/site-metadata";

// Refresh this page data every 15 seconds.
export const revalidate = 15;

// Page title and social-preview data for /session.
export const metadata = {
  title: "All Cricket Sessions - Live and Completed Matches",
  description:
    "Browse live cricket scores, finished matches, saved results, and match history in GV Cricket.",
  alternates: {
    canonical: absoluteUrl("/session"),
  },
  openGraph: {
    title: "All Cricket Sessions | GV Cricket",
    description:
      "Open live scoreboards, finished results, and saved cricket sessions in one place.",
    url: absoluteUrl("/session"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket sessions and live score preview",
      },
    ],
  },
  twitter: {
    title: "All Cricket Sessions | GV Cricket",
    description:
      "Open live scoreboards, finished results, and saved cricket sessions in one place.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
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
    <SessionsPageClient
      initialPayload={null}
      refreshToken={refreshToken}
    />
  );
}


