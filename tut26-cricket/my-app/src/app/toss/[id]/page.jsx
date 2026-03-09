import TossPageClient from "../../components/toss/TossPageClient";
import { loadTossPageData } from "../../lib/server-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TossPage({ params }) {
  const { id } = await params;
  const { match: initialMatch, authStatus } = await loadTossPageData(id);

  if (
    initialMatch &&
    initialMatch.tossWinner &&
    initialMatch.tossDecision
  ) {
    redirect(`/match/${id}`);
  }

  return (
    <TossPageClient
      matchId={id}
      initialMatch={initialMatch}
      initialAuthStatus={authStatus}
    />
  );
}
