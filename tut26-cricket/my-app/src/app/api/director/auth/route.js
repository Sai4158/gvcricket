import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import {
  getClearedDirectorAccessCookie,
  getDirectorAccessCookie,
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
  isValidDirectorPin,
} from "../../../lib/director-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceSmartPinRateLimit } from "../../../lib/pin-attempt-server";
import { ensureSameOrigin, parseJsonRequest } from "../../../lib/request-security";
import { pinPayloadSchema } from "../../../lib/validators";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;
  const authorized = hasValidDirectorAccess(token);

  const response = NextResponse.json(
    { authorized },
    { headers: { "Cache-Control": "no-store" } }
  );

  if (authorized) {
    const accessCookie = getDirectorAccessCookie();
    response.cookies.set(
      accessCookie.name,
      accessCookie.value,
      accessCookie.options
    );
  }

  return response;
}

export async function POST(req) {
  const meta = getRequestMeta(req);
  const pinAttemptLimit = enforceSmartPinRateLimit({
    key: `director-pin-attempt:${meta.ip}`,
    longLimit: 5,
    longWindowMs: 5 * 60 * 1000,
    longBlockMs: 2 * 60 * 1000,
  });

  if (!pinAttemptLimit.allowed) {
    await writeAuditLog({
      action: "director_auth_rate_limited",
      targetType: "director_console",
      targetId: "global",
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
      action: "director_auth_invalid_payload",
      targetType: "director_console",
      targetId: "global",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  if (!isValidDirectorPin(parsedRequest.value.pin)) {
    await writeAuditLog({
      action: "director_auth_failed",
      targetType: "director_console",
      targetId: "global",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonError("Incorrect PIN.", 401);
  }

  const response = NextResponse.json(
    { authorized: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  const accessCookie = getDirectorAccessCookie();
  response.cookies.set(
    accessCookie.name,
    accessCookie.value,
    accessCookie.options
  );

  await writeAuditLog({
    action: "director_auth_granted",
    targetType: "director_console",
    targetId: "global",
    status: "success",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return response;
}

export async function DELETE(req) {
  const originCheck = ensureSameOrigin(req);
  if (!originCheck.ok) {
    return jsonError(originCheck.message, originCheck.status);
  }

  const response = NextResponse.json(
    { authorized: false },
    { headers: { "Cache-Control": "no-store" } }
  );
  const clearedCookie = getClearedDirectorAccessCookie();
  response.cookies.set(
    clearedCookie.name,
    clearedCookie.value,
    clearedCookie.options
  );

  const meta = getRequestMeta(req);
  await writeAuditLog({
    action: "director_auth_logout",
    targetType: "director_console",
    targetId: "global",
    status: "success",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return response;
}
