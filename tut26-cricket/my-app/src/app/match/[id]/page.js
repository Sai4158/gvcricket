import MatchPageClient from "../../components/match/MatchPageClient";
import { absoluteUrl } from "../../lib/site-metadata";
import { loadMatchAccessData } from "../../lib/server-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Umpire Mode",
  description: "Private umpire scoring controls for live cricket scoring.",
  alternates: {
    canonical: absoluteUrl("/match"),
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MatchPage({ params }) {
  const { id } = await params;
  const { authStatus, match } = await loadMatchAccessData(id);

  if (
    authStatus === "granted" &&
    match &&
    (!match.tossWinner || !match.tossDecision)
  ) {
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
