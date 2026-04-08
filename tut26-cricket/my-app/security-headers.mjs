/**
 * File overview:
 * Purpose: Source module for Security Headers.
 * Main exports: buildContentSecurityPolicy, buildSecurityHeaders, applySecurityHeaders.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: README.md
 */
export function buildContentSecurityPolicy() {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'wasm-unsafe-eval'",
    "https://vercel.live",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://s.ytimg.com",
  ];
  const connectSrc = [
    "'self'",
    "https://vercel.com",
    "https://*.vercel.com",
    "https://*.vercel.live",
    "https://*.vercel.sh",
    "https://vitals.vercel-insights.com",
    "https://*.vercel-insights.com",
    "https://vercel.live",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://www.youtube.com:*",
    "https://www.youtube-nocookie.com:*",
    "https://www.youtubei.googleapis.com",
    "https://*.youtube.com",
    "https://*.youtube-nocookie.com",
    "https://i.ytimg.com",
    "https://s.ytimg.com",
    "https://*.ytimg.com",
    "https://*.googlevideo.com",
    "https://*.agora.io",
    "https://*.agora.io:*",
    "https://*.edge.agora.io",
    "https://*.edge.agora.io:*",
    "https://*.agoraio.cn",
    "https://*.agoraio.cn:*",
    "https://*.sd-rtn.com",
    "https://*.sd-rtn.com:*",
    "https://*.edge.sd-rtn.com",
    "https://*.edge.sd-rtn.com:*",
    "wss://*.agora.io",
    "wss://*.agora.io:*",
    "wss://*.edge.agora.io",
    "wss://*.edge.agora.io:*",
    "wss://*.agoraio.cn",
    "wss://*.agoraio.cn:*",
    "wss://*.sd-rtn.com",
    "wss://*.sd-rtn.com:*",
    "wss://*.edge.sd-rtn.com",
    "wss://*.edge.sd-rtn.com:*",
    "wss://*.pusher.com",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `script-src-elem ${scriptSrc.join(" ")}`,
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://i.ibb.co https://ibb.co https://i.ytimg.com https://*.ytimg.com https://vercel.com https://*.vercel.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    "media-src 'self' blob: data: https://*.googlevideo.com https://*.youtube.com https://*.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://*.youtube-nocookie.com https://vercel.live",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

export function buildSecurityHeaders({
  isProduction = process.env.NODE_ENV === "production",
} = {}) {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: CONTENT_SECURITY_POLICY,
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=(self)",
        "geolocation=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-site",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

export function applySecurityHeaders(headers, options) {
  for (const { key, value } of buildSecurityHeaders(options)) {
    headers.set(key, value);
  }
  return headers;
}
