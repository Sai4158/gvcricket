import SessionsPageClient from "../components/session/SessionsPageClient";
import { absoluteUrl, siteConfig } from "../lib/site-metadata";
import { loadSessionsIndexPageData } from "../lib/server-data";

export const revalidate = 15;

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

export default async function SessionsPage({ searchParams }) {
  const { sessions, totalCount } = await loadSessionsIndexPageData();
  const resolvedSearchParams = await searchParams;
  const refreshToken = String(resolvedSearchParams?.refresh || "").trim();
  return (
    <SessionsPageClient
      initialSessions={sessions}
      initialTotalCount={totalCount}
      refreshToken={refreshToken}
    />
  );
}
