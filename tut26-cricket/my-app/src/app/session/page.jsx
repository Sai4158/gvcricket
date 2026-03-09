import SessionsPageClient from "../components/session/SessionsPageClient";
import { loadSessionsIndexData } from "../lib/server-data";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const initialSessions = await loadSessionsIndexData();
  return <SessionsPageClient initialSessions={initialSessions} />;
}
