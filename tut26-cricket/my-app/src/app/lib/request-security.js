/**
 * File overview:
 * Purpose: Shared helper module for Request Security logic.
 * Main exports: getExpectedOrigin, isSameOriginRequest, enforceRequestSize, ensureSameOrigin, ensureJsonContentType, ensureMultipartContentType, formatZodError.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import { ZodError } from "zod";

function getForwardedHost(request) {
  return (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  );
}

function getForwardedProto(request) {
  return request.headers.get("x-forwarded-proto") || "http";
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function getExpectedOrigin(request) {
  const host = getForwardedHost(request);
  if (!host) return "";
  return `${getForwardedProto(request)}://${host}`;
}

export function isSameOriginRequest(request) {
  const expectedOrigin = getExpectedOrigin(request);
  if (!expectedOrigin) return false;

  const origin = normalizeOrigin(request.headers.get("origin") || "");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = normalizeOrigin(request.headers.get("referer") || "");
  if (referer) {
    return referer === expectedOrigin;
  }

  return false;
}

export function enforceRequestSize(request, maxBytes) {
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: "Request payload is too large.",
    };
  }

  return { ok: true };
}

export function ensureSameOrigin(request) {
  if (!isSameOriginRequest(request)) {
    return {
      ok: false,
      status: 403,
      message: "Cross-site request blocked.",
    };
  }

  return { ok: true };
}

export function ensureJsonContentType(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      status: 415,
      message: "JSON content type is required.",
    };
  }

  return { ok: true };
}

export function ensureMultipartContentType(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return {
      ok: false,
      status: 415,
      message: "Multipart form data is required.",
    };
  }

  return { ok: true };
}

export function formatZodError(error) {
  if (!(error instanceof ZodError)) {
    return "Invalid request payload.";
  }

  const issue = error.issues[0];
  if (!issue) return "Invalid request payload.";

  if (issue.path?.length) {
    return `${issue.path.join(".")} is invalid.`;
  }

  return issue.message || "Invalid request payload.";
}

export async function parseJsonRequest(request, schema, options = {}) {
  const sizeCheck = enforceRequestSize(request, options.maxBytes ?? 64 * 1024);
  if (!sizeCheck.ok) return sizeCheck;

  const originCheck = ensureSameOrigin(request);
  if (!originCheck.ok) return originCheck;

  const contentTypeCheck = ensureJsonContentType(request);
  if (!contentTypeCheck.ok) return contentTypeCheck;

  const rawText = await request.text();
  if (Buffer.byteLength(rawText, "utf8") > (options.maxBytes ?? 64 * 1024)) {
    return {
      ok: false,
      status: 413,
      message: "Request payload is too large.",
    };
  }

  let parsedJson;
  try {
    parsedJson = rawText ? JSON.parse(rawText) : {};
  } catch {
    return { ok: false, status: 400, message: "Malformed JSON body." };
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: formatZodError(validated.error),
    };
  }

  return { ok: true, value: validated.data };
}

export async function parseMultipartRequest(request, options = {}) {
  const sizeCheck = enforceRequestSize(request, options.maxBytes ?? 6 * 1024 * 1024);
  if (!sizeCheck.ok) return sizeCheck;

  const originCheck = ensureSameOrigin(request);
  if (!originCheck.ok) return originCheck;

  const contentTypeCheck = ensureMultipartContentType(request);
  if (!contentTypeCheck.ok) return contentTypeCheck;

  const formData = await request.formData();
  return { ok: true, value: formData };
}
