import SessionsPageClient from "../components/session/SessionsPageClient";
import { absoluteUrl } from "../lib/site-metadata";
import { loadSessionsIndexData } from "../lib/server-data";

export const dynamic = "force-dynamic";

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
  },
};

export default async function SessionsPage() {
  const initialSessions = await loadSessionsIndexData();
  return <SessionsPageClient initialSessions={initialSessions} />;
}
