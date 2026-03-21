import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
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
  const exists = await Session.exists({ _id: id, isDraft: true });
  if (!exists) {
    notFound();
  }

  return <TeamSelectionPageClient />;
}
