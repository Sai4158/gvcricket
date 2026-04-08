/**
 * File overview:
 * Purpose: App Router page entry for Toss.
 * Main exports: dynamic.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ../../../../docs/ONBOARDING.md
 */
import TossPageClient from "../../components/toss/TossPageClient";
import { loadTossPageData } from "../../lib/server-data";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TossPage({ params }) {
  const { id } = await params;
  const {
    found,
    match: initialMatch,
    authStatus,
    sessionId,
    hasCreatedMatch,
    actualMatchId,
  } = await loadTossPageData(id);

  if (!found) {
    notFound();
  }

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
