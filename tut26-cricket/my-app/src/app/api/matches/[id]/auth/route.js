import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import { writeAuditLog } from "../../../../lib/audit-log";
import { connectDB } from "../../../../lib/db";
import {
  buildSessionMirrorUpdate,
} from "../../../../lib/match-engine";
import {
  getClearedMatchAccessCookie,
  getMatchAccessCookie,
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../../lib/match-access";
import { hydrateLegacyTossState } from "../../../../lib/match-toss";
import { pinPayloadSchema } from "../../../../lib/validators";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { ensureSameOrigin, parseJsonRequest } from "../../../../lib/request-security";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

async function loadMatchAccessState(matchId) {
  await connectDB();
  const match = await Match.findById(matchId).select(
    "_id adminAccessVersion teamA teamB teamAName teamBName sessionId tossWinner tossDecision innings1 innings2"
  );

  if (!match) {
    return match;
  }

  const fallbackSession = match.sessionId
    ? await Session.findById(match.sessionId).select(
        "tossWinner tossDecision teamAName teamBName teamA teamB"
      )
    : null;

  if (hydrateLegacyTossState(match, fallbackSession)) {
    await match.save();
    await Session.findByIdAndUpdate(match.sessionId, {
      $set: buildSessionMirrorUpdate(match),
    });
  }

  return match;
}

async function hasAuthorizedCookie(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;

  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function GET(_req, { params }) {
  const { id } = await params;
  const match = await loadMatchAccessState(id);

  if (!match) {
    return jsonError("Match not found.", 404);
  }

  const authorized = await hasAuthorizedCookie(id, match.adminAccessVersion || 1);

  const response = NextResponse.json(
    {
      authorized,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  if (authorized) {
    const matchCookie = getMatchAccessCookie(
      id,
      Number(match.adminAccessVersion || 1)
    );
    response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);
  }

  return response;
}

export async function POST(req, { params }) {
  const { id } = await params;
  const meta = getRequestMeta(req);
  const pinAttemptLimit = enforceRateLimit({
    key: `pin-attempt:${id}:${meta.ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!pinAttemptLimit.allowed) {
    await writeAuditLog({
      action: "umpire_auth_rate_limited",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: pinAttemptLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many PIN attempts. Try again shortly.",
      pinAttemptLimit.retryAfterMs
    );
  }

  const parsedRequest = await parseJsonRequest(req, pinPayloadSchema, {
    maxBytes: 2048,
  });

  if (!parsedRequest.ok) {
    await writeAuditLog({
      action: "umpire_auth_invalid_payload",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  const match = await loadMatchAccessState(id);
  if (!match) {
    return jsonError("Match not found.", 404);
  }

  if (!isValidUmpirePin(parsedRequest.value.pin)) {
    await writeAuditLog({
      action: "umpire_auth_failed",
      targetType: "match",
      targetId: id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonError("Incorrect PIN.", 401);
  }

  const response = NextResponse.json(
    { authorized: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
  const matchCookie = getMatchAccessCookie(
    id,
    Number(match.adminAccessVersion || 1)
  );
  response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);

  await writeAuditLog({
    action: "umpire_auth_granted",
    targetType: "match",
    targetId: id,
    status: "success",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return response;
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const originCheck = ensureSameOrigin(req);
  if (!originCheck.ok) {
    return jsonError(originCheck.message, originCheck.status);
  }

  const response = NextResponse.json(
    { authorized: false },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
  const clearedCookie = getClearedMatchAccessCookie(id);
  response.cookies.set(
    clearedCookie.name,
    clearedCookie.value,
    clearedCookie.options
  );

  const meta = getRequestMeta(req);
  await writeAuditLog({
    action: "umpire_auth_logout",
    targetType: "match",
    targetId: id,
    status: "success",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return response;
}
