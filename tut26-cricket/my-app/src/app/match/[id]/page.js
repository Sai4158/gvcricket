import MatchPageClient from "../../components/match/MatchPageClient";
import { absoluteUrl, siteConfig } from "../../lib/site-metadata";
import { loadMatchAccessData } from "../../lib/server-data";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Umpire Mode",
  description: "Private umpire scoring controls for live cricket scoring.",
  alternates: {
    canonical: absoluteUrl("/match"),
  },
  openGraph: {
    title: "Umpire Mode | GV Cricket",
    description: "Private umpire scoring controls for live cricket scoring.",
    url: absoluteUrl("/match"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket umpire mode preview",
      },
    ],
  },
  twitter: {
    title: "Umpire Mode | GV Cricket",
    description: "Private umpire scoring controls for live cricket scoring.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MatchPage({ params }) {
  const { id } = await params;
  const { found, authStatus, match } = await loadMatchAccessData(id);

  if (!found) {
    notFound();
  }

  if (authStatus === "granted" && match && !match.tossReady) {
    redirect(`/toss/${id}`);
  }

  return (
    <MatchPageClient
      matchId={id}
      initialAuthStatus={authStatus}
      initialMatch={match}
    />
  );
}
