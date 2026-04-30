/**
 * File overview:
 * Purpose: Renders an OBS-friendly overlay page that tracks the latest match in a session.
 * Main exports: dynamic.
 * Major callers: Next.js App Router and OBS browser sources.
 * Side effects: none.
 * Read next: ../../../components/session-overlay/SessionOverlayClient.jsx
 */

import { notFound } from "next/navigation";
import SessionOverlayClient from "../../../components/session-overlay/SessionOverlayClient";
import { loadSessionViewData } from "../../../lib/server-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GV Cricket Live Overlay",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SessionOverlayPage({ params }) {
  const { id } = await params;
  const initialData = await loadSessionViewData(id);

  if (!initialData?.found || !initialData?.session) {
    notFound();
  }

  return <SessionOverlayClient sessionId={id} initialData={initialData} />;
}
