import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { connectDB } from "../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../lib/match-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { validateMatchPatchPayload } from "../../../lib/validators";
import Match from "../../../../models/Match";
import Session from "../../../../models/Session";

async function requireMatchAccess(matchId) {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(getMatchAccessCookieName(matchId));

  return hasValidMatchAccess(matchId, accessCookie?.value);
}

export async function GET(_req, { params }) {
  try {
    await connectDB();
    const match = await Match.findById(params.id);

    if (!match) {
      return NextResponse.json({ message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching match", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const meta = getRequestMeta(req);
    const hasAccess = await requireMatchAccess(params.id);

    if (!hasAccess) {
      await writeAuditLog({
        action: "match_patch_denied",
        targetType: "match",
        targetId: params.id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Umpire access required", 403);
    }

    const updateLimit = enforceRateLimit({
      key: `match-patch:${params.id}:${meta.ip}`,
      limit: 12,
      windowMs: 1000,
      blockMs: 3000,
    });

    if (!updateLimit.allowed) {
      await writeAuditLog({
        action: "match_patch_rate_limited",
        targetType: "match",
        targetId: params.id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { retryAfterMs: updateLimit.retryAfterMs },
      });

      return jsonRateLimit(
        "Too many scoring updates. Slow down briefly.",
        updateLimit.retryAfterMs
      );
    }

    const data = await req.json().catch(() => null);
    const validation = validateMatchPatchPayload(data);

    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const changedFields = Object.keys(validation.value);
    const isMediaUpdate = changedFields.some(
      (field) =>
        field.toLowerCase().includes("image") ||
        field.toLowerCase().includes("media")
    );

    if (isMediaUpdate) {
      const mediaLimit = enforceRateLimit({
        key: `match-media:${params.id}:${meta.ip}`,
        limit: 5,
        windowMs: 60 * 1000,
        blockMs: 60 * 1000,
      });

      if (!mediaLimit.allowed) {
        return jsonRateLimit(
          "Too many media update attempts. Try again shortly.",
          mediaLimit.retryAfterMs
        );
      }
    }

    await connectDB();

    const updateQuery = { $set: {} };
    for (const key in validation.value) {
      updateQuery.$set[key] = validation.value[key];
    }

    const updated = await Match.findByIdAndUpdate(params.id, updateQuery, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return jsonError("Match not found for update", 404);
    }

    const sessionUpdate = {};

    if ("teamA" in updateQuery.$set) sessionUpdate.teamA = updated.teamA;
    if ("teamB" in updateQuery.$set) sessionUpdate.teamB = updated.teamB;
    if ("teamAName" in updateQuery.$set) sessionUpdate.teamAName = updated.teamAName;
    if ("teamBName" in updateQuery.$set) sessionUpdate.teamBName = updated.teamBName;
    if ("overs" in updateQuery.$set) sessionUpdate.overs = updated.overs;
    if ("tossWinner" in updateQuery.$set) {
      sessionUpdate.tossWinner = updated.tossWinner;
    }
    if ("isOngoing" in updateQuery.$set) {
      sessionUpdate.isLive = updated.isOngoing;
    }

    if (Object.keys(sessionUpdate).length > 0) {
      await Session.findByIdAndUpdate(updated.sessionId, {
        $set: sessionUpdate,
      });
    }

    await writeAuditLog({
      action: isMediaUpdate ? "match_media_edit" : "match_patch",
      targetType: "match",
      targetId: params.id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { fields: changedFields },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Validation Error", error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Error updating match", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const meta = getRequestMeta(_req);
    const hasAccess = await requireMatchAccess(params.id);

    if (!hasAccess) {
      await writeAuditLog({
        action: "match_delete_denied",
        targetType: "match",
        targetId: params.id,
        status: "failure",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return jsonError("Umpire access required", 403);
    }

    await connectDB();
    const deletedMatch = await Match.findByIdAndDelete(params.id);

    if (!deletedMatch) {
      return jsonError("Match not found", 404);
    }

    await writeAuditLog({
      action: "match_delete",
      targetType: "match",
      targetId: params.id,
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { message: "Error deleting match", error: error.message },
      { status: 500 }
    );
  }
}
