export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function getRequestMeta(request) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") || "",
  };
}
