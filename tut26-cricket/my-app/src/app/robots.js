/**
 * File overview:
 * Purpose: Source module for Robots.
 * Main exports: robots.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: README.md
 */
import { absoluteUrl } from "./lib/site-metadata";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/director", "/match", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
