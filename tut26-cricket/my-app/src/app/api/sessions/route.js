/**
 * File overview:
 * Purpose: Handles Api API requests for the app.
 * Main exports: module side effects only.
 * Major callers: Next.js request handlers and client fetch calls.
 * Side effects: none.
 * Read next: ../../../../docs/ONBOARDING.md
 */

import Session from "../../../models/Session.js";
import { jsonError, jsonRateLimit } from "../../lib/api-response";
import { writeAuditLog } from "../../lib/audit-log";
import { connectDB } from "../../lib/db";
import { loadSessionsIndexPageData } from "../../lib/server-data";
import { serializePublicSession } from "../../lib/public-data";
import { getRequestMeta } from "../../lib/request-meta";
import { enforceRateLimit } from "../../lib/rate-limit";
import { parseJsonRequest } from "../../lib/request-security";
import { createDraftToken, createDraftTokenHash } from "../../lib/session-draft";
import { sessionCreateSchema } from "../../lib/validators";

export async function POST(req) {
  const meta = getRequestMeta(req);
  const createLimit = enforceRateLimit({
    key: `session-create:${meta.ip}`,
    limit: 5,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
  });

  if (!createLimit.allowed) {
    await writeAuditLog({
      action: "session_create_rate_limited",
      targetType: "session",
      status: "failure",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { retryAfterMs: createLimit.retryAfterMs },
    });

    return jsonRateLimit(
      "Too many session creation attempts. Try again shortly.",
      createLimit.retryAfterMs
    );
  }

  try {
    const parsedRequest = await parseJsonRequest(req, sessionCreateSchema, {
      maxBytes: 4096,
    });
    if (!parsedRequest.ok) {
      return jsonError(parsedRequest.message, parsedRequest.status);
    }

    await connectDB();
    const draftToken = createDraftToken();
    const session = await Session.create({
      ...parsedRequest.value,
      isDraft: true,
      draftTokenHash: createDraftTokenHash(draftToken),
    });

    await writeAuditLog({
      action: "session_create",
      targetType: "session",
      targetId: String(session._id),
      status: "success",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return Response.json(
      {
        ...serializePublicSession(session),
        draftToken,
      },
      {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
      }
    );
  } catch {
    return jsonError("Could not create the session.", 500);
  }
}

export async function GET(req) {
  try {
    const requestUrl = new URL(req.url);
    const page = Number(requestUrl.searchParams.get("page") || 1);
    const limit = Number(requestUrl.searchParams.get("limit") || 28);
    const search = String(requestUrl.searchParams.get("search") || "").trim();
    const filter = String(requestUrl.searchParams.get("filter") || "").trim();
    const sort = String(requestUrl.searchParams.get("sort") || "").trim();
    const includeCounts = requestUrl.searchParams.get("counts") !== "0";
    const {
      sessions,
      page: resolvedPage,
      limit: resolvedLimit,
      totalCount,
      totalPages,
      unfilteredTotalCount,
      hasNextPage,
      hasPreviousPage,
      countsPending,
    } = await loadSessionsIndexPageData({
      page,
      limit,
      search,
      filter,
      sort,
      includeCounts,
    });

    return Response.json(
      {
        sessions,
        page: resolvedPage,
        limit: resolvedLimit,
        totalCount,
        totalPages,
        unfilteredTotalCount,
        hasNextPage,
        hasPreviousPage,
        countsPending,
      },
      {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=45",
        "X-Total-Count": String(Number(totalCount || 0)),
      },
      }
    );
  } catch {
    return jsonError("Failed to retrieve sessions.", 500);
  }
}


