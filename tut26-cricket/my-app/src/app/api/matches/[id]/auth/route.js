import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../../lib/api-response";
import {
  getMatchAccessCookie,
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../../lib/match-access";
import { writeAuditLog } from "../../../../lib/audit-log";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { validatePinPayload } from "../../../../lib/validators";

export async function GET(_req, { params }) {
  const cookieStore = await cookies();
  const cookieName = getMatchAccessCookieName(params.id);
  const token = cookieStore.get(cookieName)?.value;

  return NextResponse.json({
    authorized: hasValidMatchAccess(params.id, token),
  });
}

export async function POST(req, { params }) {
  const meta = getRequestMeta(req);
  const pinAttemptLimit = enforceRateLimit({
    key: `pin-attempt:${params.id}:${meta.ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!pinAttemptLimit.allowed) {
    await writeAuditLog({
      action: "umpire_auth_rate_limited",
      targetType: "match",
      targetId: params.id,
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

  const body = await req.json().catch(() => null);
  const validation = validatePinPayload(body);

  if (!validation.ok) {
    await writeAuditLog({
      action: "umpire_auth_invalid_payload",
      targetType: "match",
      targetId: params.id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonError(validation.message, 400);
  }

  if (!isValidUmpirePin(validation.value.pin)) {
    await writeAuditLog({
      action: "umpire_auth_failed",
      targetType: "match",
      targetId: params.id,
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonError("Incorrect PIN.", 401);
  }

  const response = NextResponse.json({ authorized: true });
  const matchCookie = getMatchAccessCookie(params.id);
  response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);

  await writeAuditLog({
    action: "umpire_auth_granted",
    targetType: "match",
    targetId: params.id,
    status: "success",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return response;
}
