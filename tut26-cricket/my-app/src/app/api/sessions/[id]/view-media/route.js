/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { jsonError } from "../../../../lib/api-response";
import { loadSessionViewMediaData } from "../../../../lib/server-data";

export async function GET(_req, { params }) {
  const { id } = await params;

  try {
    const payload = await loadSessionViewMediaData(id);
    if (!payload?.found || !payload.media) {
      return jsonError("Session not found.", 404);
    }

    return Response.json(payload.media, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Failed to load session media.", 500);
  }
}
