import SessionViewClient from "../../../components/session-view/SessionViewClient";
import { loadSessionViewData } from "../../../lib/server-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewSessionPage({ params }) {
  const { id } = await params;
  const initialData = await loadSessionViewData(id);

  if (initialData?.match?._id && !initialData.match.isOngoing) {
    redirect(`/result/${initialData.match._id}`);
  }

  return <SessionViewClient sessionId={id} initialData={initialData} />;
}
