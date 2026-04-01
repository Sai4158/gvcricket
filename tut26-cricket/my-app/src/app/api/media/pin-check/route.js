import { jsonError, jsonRateLimit } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit-log";
import {
  IMAGE_PIN_ATTEMPT_BLOCK_MS,
  IMAGE_PIN_ATTEMPT_LIMIT,
  IMAGE_PIN_ATTEMPT_WINDOW_MS,
} from "../../../lib/image-pin-policy";
import { isValidManagePin, isValidUmpirePin } from "../../../lib/match-access";
import { getRequestMeta } from "../../../lib/request-meta";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { parseJsonRequest } from "../../../lib/request-security";
import { z } from "zod";

const mediaPinCheckSchema = z
  .object({
    pin: z
      .string()
      .trim()
      .regex(/^(\d{4}|\d{6})$/, "PIN must be 4 or 6 digits."),
    allowUmpirePin: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(req) {
  const meta = getRequestMeta(req);
  const pinAttemptLimit = enforceRateLimit({
    key: `media-pin-check:${meta.ip}`,
    limit: IMAGE_PIN_ATTEMPT_LIMIT,
    windowMs: IMAGE_PIN_ATTEMPT_WINDOW_MS,
    blockMs: IMAGE_PIN_ATTEMPT_BLOCK_MS,
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

  const parsedRequest = await parseJsonRequest(req, mediaPinCheckSchema, {
    maxBytes: 2048,
  });
  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.message, parsedRequest.status);
  }

  const submittedPin = parsedRequest.value.pin;
  const isValidPin = parsedRequest.value.allowUmpirePin
    ? isValidUmpirePin(submittedPin) || isValidManagePin(submittedPin)
    : isValidManagePin(submittedPin);

  if (!isValidPin) {
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
