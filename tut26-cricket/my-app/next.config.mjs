/**
 * File overview:
 * Purpose: Defines Next.Config behavior used by the app.
 * Main exports: default export.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: reads server request metadata.
 * Read next: ./README.md
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders } from "./security-headers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSecurityHeaders = buildSecurityHeaders();

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: sharedSecurityHeaders,
      },
      {
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/gvLogo.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      {
        pathname: "/gvLogo.png",
      },
      {
        pathname: "/videos/**",
      },
      {
        pathname: "/Thumb1.png",
      },
      {
        pathname: "/api/matches/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",
        pathname: "/**",
      },
    ],
  },
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["@tensorflow/tfjs", "nsfwjs", "sharp"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;


