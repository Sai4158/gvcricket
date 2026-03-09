import MatchPageClient from "../../components/match/MatchPageClient";
import { loadMatchAccessData } from "../../lib/server-data";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }) {
  const { id } = await params;
  const { authStatus, match } = await loadMatchAccessData(id);

  return (
    <MatchPageClient
      matchId={id}
      initialAuthStatus={authStatus}
      initialMatch={match}
    />
  );
}
