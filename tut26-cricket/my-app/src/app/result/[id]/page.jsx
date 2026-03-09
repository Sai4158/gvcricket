import ResultPageClient from "../../components/result/ResultPageClient";
import { loadPublicMatchData } from "../../lib/server-data";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }) {
  const { id } = await params;
  const initialMatch = await loadPublicMatchData(id);

  return <ResultPageClient matchId={id} initialMatch={initialMatch} />;
}
