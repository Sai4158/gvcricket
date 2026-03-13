import ResultPageClient from "../../components/result/ResultPageClient";
import {
  absoluteUrl,
  getMatchupLabel,
  siteConfig,
} from "../../lib/site-metadata";
import { loadPublicMatchData } from "../../lib/server-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const match = await loadPublicMatchData(id);
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
      images: [absoluteUrl(`/result/${id}/opengraph-image`)],
    },
    twitter: {
      title: `${pageLabel} | GV Cricket`,
      description: `Final score and match stats for ${matchup}.`,
      images: [absoluteUrl(`/result/${id}/twitter-image`)],
    },
  };
}

export default async function ResultPage({ params }) {
  const { id } = await params;
  const initialMatch = await loadPublicMatchData(id);

  return <ResultPageClient matchId={id} initialMatch={initialMatch} />;
}
