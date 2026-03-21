import { notFound } from "next/navigation";
import ResultPageClient from "../../components/result/ResultPageClient";
import {
  absoluteUrl,
  getMatchupLabel,
  siteConfig,
  versionedSocialImagePath,
} from "../../lib/site-metadata";
import { loadPublicMatchData } from "../../lib/server-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const match = await loadPublicMatchData(id);
  if (!match) {
    return {
      title: "Result Not Found",
      description: "This match result could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const matchup = getMatchupLabel({
    sessionName: "",
    teamAName: match?.teamAName,
    teamBName: match?.teamBName,
  });
  const pageLabel =
    matchup === "Cricket match" ? "Match Result and Stats" : `${matchup} Result and Stats`;
  const resultText = match?.result ? ` ${match.result}` : "";

  return {
    title: pageLabel,
    description: `See the final score, winner, over summary, and match stats for ${matchup}.${resultText}`.trim(),
    alternates: {
      canonical: absoluteUrl(`/result/${id}`),
    },
    openGraph: {
      title: `${pageLabel} | GV Cricket`,
      description: `Final score, winner, over summary, and match stats for ${matchup}.`,
      url: absoluteUrl(`/result/${id}`),
      images: [absoluteUrl(versionedSocialImagePath(`/result/${id}/opengraph-image`))],
    },
    twitter: {
      title: `${pageLabel} | GV Cricket`,
      description: `Final score and match stats for ${matchup}.`,
      images: [absoluteUrl(versionedSocialImagePath(`/result/${id}/twitter-image`))],
    },
  };
}

export default async function ResultPage({ params }) {
  const { id } = await params;
  const initialMatch = await loadPublicMatchData(id);
  if (!initialMatch) {
    notFound();
  }

  return <ResultPageClient matchId={id} initialMatch={initialMatch} />;
}
