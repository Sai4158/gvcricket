/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: reads server request metadata.
 * Read next: ../../../../../../docs/ONBOARDING.md
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import { createManualScoreAnnouncementLiveEvent } from "../../../../lib/live-announcements";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { publishMatchUpdate } from "../../../../lib/live-updates";
import { getRequestMeta } from "../../../../lib/request-meta";
import { parseJsonRequest } from "../../../../lib/request-security";
import Match from "../../../../../models/Match";

const manualAnnouncementRequestSchema = z.object({}).strict();

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const parsedRequest = await parseJsonRequest(req, manualAnnouncementRequestSchema, {
      maxBytes: 1024,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const match = await Match.findById(id);
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(id, Number(match.adminAccessVersion || 1));
    if (!hasAccess) {
      await writeAuditLog({
        action: "match_manual_announcement_denied",
        targetType: "match",
        targetId: id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return jsonError("Umpire access required.", 403);
    }

    if (!match.isOngoing || match.result) {
      return jsonError("Announcements only work during a live match.", 409);
    }

    const liveEvent = createManualScoreAnnouncementLiveEvent(match);
    const updatedMatch = await Match.findByIdAndUpdate(
      id,
      {
        $set: {
          lastLiveEvent: liveEvent,
          lastEventType: liveEvent.type,
          lastEventText: liveEvent.summaryText,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedMatch) {
      return jsonError("Match not found.", 404);
    }

    publishMatchUpdate(updatedMatch._id);

    await writeAuditLog({
      action: "match_manual_announcement",
      targetType: "match",
      targetId: id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(
      { ok: true, eventId: liveEvent.id },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Manual score announcement failed:", error);
    return jsonError("Could not announce the current score.", 500);
  }
}


