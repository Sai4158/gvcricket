import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import { isValidManagePin } from "../../../lib/match-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { parseJsonRequest } from "../../../lib/request-security";
import { secretPinPayloadSchema } from "../../../lib/validators";

export async function POST(req) {
  const meta = getRequestMeta(req);
  const pinAttemptLimit = enforceRateLimit({
    key: `media-pin-check:${meta.ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
    blockMs: 2 * 60 * 1000,
  });

  if (!pinAttemptLimit.allowed) {
    await writeAuditLog({
      action: "media_pin_rate_limited",
      targetType: "media",
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

  const parsedRequest = await parseJsonRequest(req, secretPinPayloadSchema, {
    maxBytes: 2048,
  });
  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  if (!isValidManagePin(parsedRequest.value.pin)) {
    await writeAuditLog({
      action: "media_pin_failed",
      targetType: "media",
      targetId: "global",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonError("Incorrect PIN.", 401);
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
