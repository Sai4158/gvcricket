import TossPageClient from "../../components/toss/TossPageClient";
import { loadPublicMatchData } from "../../lib/server-data";

export const dynamic = "force-dynamic";

export default async function TossPage({ params }) {
  const { id } = await params;
  const initialMatch = await loadPublicMatchData(id);

  return <TossPageClient matchId={id} initialMatch={initialMatch} />;
}
