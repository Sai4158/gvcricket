import { isValidObjectId } from "mongoose";
import { notFound, redirect } from "next/navigation";
import Session from "../../../models/Session";
import { connectDB } from "../../lib/db";
import TeamSelectionPageClient from "./TeamSelectionPageClient";

export const dynamic = "force-dynamic";

export default async function TeamSelectionPage({ params }) {
  const { id } = await params;

  if (!isValidObjectId(id)) {
    notFound();
  }

  await connectDB();
  const session = await Session.findById(id).select(
    "_id isDraft match tossWinner tossDecision"
  );
  if (!session) {
    notFound();
  }

  if (session.match) {
    if (session.tossWinner && session.tossDecision) {
      redirect(`/match/${session.match}`);
    }

    redirect(`/toss/${session.match}`);
  }

  return <TeamSelectionPageClient sessionId={id} />;
}
