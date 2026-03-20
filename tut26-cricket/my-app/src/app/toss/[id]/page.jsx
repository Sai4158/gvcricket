import TossPageClient from "../../components/toss/TossPageClient";
import { loadTossPageData } from "../../lib/server-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TossPage({ params }) {
  const { id } = await params;
  const {
    match: initialMatch,
    authStatus,
    sessionId,
    hasCreatedMatch,
    actualMatchId,
  } = await loadTossPageData(id);

  if (
    hasCreatedMatch &&
    initialMatch &&
    initialMatch.tossWinner &&
    initialMatch.tossDecision
  ) {
    redirect(`/match/${actualMatchId || id}`);
  }

  return (
    <TossPageClient
      matchId={actualMatchId || ""}
      sessionId={sessionId || id}
      initialMatch={initialMatch}
      initialAuthStatus={authStatus}
      hasCreatedMatch={hasCreatedMatch}
    />
  );
}
