/**
 * File overview:
 * Purpose: Provides shared Site Metadata logic for routes, APIs, and feature code.
 * Main exports: getPublicSiteUrl, getSiteUrl, absoluteUrl, buildShareUrl, versionedSocialImagePath, cleanText, pluralizeRuns, pluralizeWickets, getMatchupLabel, buildPageTitle, siteConfig.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

export const siteConfig = {
  name: "GV Cricket",
  shortName: "GV Cricket",
  url: "https://www.gvcricket.com",
  logoPath: "/gvLogo.png",
  shareLogoPath: "/gvLogo.png",
  socialImageVersion: "2026-04-23-result-share-collage",
  description:
    "GV Cricket is a free live cricket scoring app for local matches, leagues, tournaments, school cricket, box cricket, and tennis-ball cricket with umpire mode, spectator scoreboards, match results, and mobile-first control for cricket communities in India, Pakistan, Bangladesh, Sri Lanka, Nepal, UAE, and more.",
  defaultTitle:
    "GV Cricket | Free Live Cricket Scoring App, Umpire Mode, Scoreboard",
  ogTitle:
    "GV Cricket | Free Live Cricket Scoring and Match Control",
  keywords: [
    "gv cricket 2.0",
    "gv cricket",
    "live cricket scoring app",
    "live cricket score app",
    "live cricket scoreboard",
    "free cricket scorer",
    "free cricket scoring app",
    "cricket score app",
    "cricket scoring website",
    "cricket umpire scoring app",
    "cricket scorer for local matches",
    "cricket scorer for tournaments",
    "cricket scoring app for leagues",
    "cricket scoring app for school cricket",
    "box cricket scoring app",
    "tennis ball cricket score app",
    "live score app for cricket matches",
    "cricket result app",
    "cricket scorekeeper app",
    "cricket director console",
    "cricket walkie talkie app",
    "cricket loudspeaker app",
    "live cricket scorekeeper app",
    "cricket scoring app for local matches",
    "cricket scoring app for umpires and spectators",
    "mobile cricket scoring app",
    "online cricket scoring app",
    "cricket overs wickets score app",
    "cricket match scoring app",
    "cricket live score for clubs",
    "cricket live score for community matches",
    "ipl style cricket scoring app",
    "cricket scoring app india",
    "cricket scoring app pakistan",
    "cricket scoring app bangladesh",
    "cricket scoring app sri lanka",
    "cricket scoring app nepal",
    "cricket scoring app uae",
    "tennis ball cricket scoring app india",
    "box cricket scoring app india",
    "local cricket scoring app",
    "community cricket scoring app",
    "cricket scoring app alternative",
  ],
  ogImagePath: "/opengraph-image?v=2026-04-23-result-share-collage",
  twitterImagePath: "/twitter-image?v=2026-04-23-result-share-collage",
};

function normalizeSiteUrl(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function isLocalOrigin(value = "") {
  try {
    const { hostname } = new URL(normalizeSiteUrl(value));
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function getPublicSiteUrl() {
  const explicitUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (explicitUrl) {
    return explicitUrl;
  }

  return normalizeSiteUrl(siteConfig.url) || siteConfig.url;
}

export function getSiteUrl() {
  const explicitUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (explicitUrl) {
    return explicitUrl;
  }

  const productionUrl = normalizeSiteUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ""
  );
  if (productionUrl) {
    return productionUrl;
  }

  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  const previewUrl = normalizeSiteUrl(
    process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || ""
  );
  if (vercelEnv && vercelEnv !== "production" && previewUrl) {
    return previewUrl;
  }

  return getPublicSiteUrl();
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}

export function buildShareUrl(path = "/", currentOrigin = "") {
  const normalizedCurrentOrigin = normalizeSiteUrl(currentOrigin);
  const baseUrl = isLocalOrigin(normalizedCurrentOrigin)
    ? getPublicSiteUrl() || getSiteUrl()
    : normalizedCurrentOrigin || getPublicSiteUrl() || getSiteUrl();
  return new URL(path, baseUrl).toString();
}

export function versionedSocialImagePath(path = "/") {
  const cleanPath = String(path || "/").trim() || "/";
  const separator = cleanPath.includes("?") ? "&" : "?";
  return `${cleanPath}${separator}v=${siteConfig.socialImageVersion}`;
}

export function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/Â·/g, "·")
    .trim();
}

export function pluralizeRuns(runs = 0) {
  return Number(runs) === 1 ? "run" : "runs";
}

export function pluralizeWickets(wickets = 0) {
  return Number(wickets) === 1 ? "wicket" : "wickets";
}

export function getMatchupLabel({
  sessionName = "",
  teamAName = "",
  teamBName = "",
}) {
  const left = cleanText(teamAName);
  const right = cleanText(teamBName);

  if (left && right && left !== "Team A" && right !== "Team B") {
    return `${left} vs ${right}`;
  }

  return cleanText(sessionName) || "Cricket match";
}

export function buildPageTitle(title) {
  return cleanText(title);
}


