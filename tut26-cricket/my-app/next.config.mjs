import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
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
  },
  serverExternalPackages: ["@tensorflow/tfjs", "nsfwjs", "sharp"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
