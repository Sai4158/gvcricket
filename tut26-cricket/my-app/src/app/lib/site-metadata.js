export const siteConfig = {
  name: "GV Cricket",
  shortName: "GV Cricket",
  url: "https://www.gvcricket.com",
  logoPath: "/gvLogo.png",
  shareLogoPath: "/gvLogo.png",
  socialImageVersion: "2026-03-20-logo",
  description:
    "GV Cricket is a live cricket scoring app with umpire mode, spectator scoreboards, director controls, walkie-talkie, loudspeaker, match images, and instant results in one fast mobile flow.",
  defaultTitle:
    "GV Cricket | Live Cricket Scoring, Umpire Mode, Director Controls",
  ogTitle:
    "GV Cricket | Live Cricket Scoring and Match Control",
  keywords: [
    "gv cricket 2.0",
    "gv cricket",
    "live cricket scoring app",
    "free cricket scorer",
    "cricket score app",
    "cricket umpire scoring app",
    "cricket director console",
    "cricket walkie talkie app",
    "cricket loudspeaker app",
    "live cricket scorekeeper app",
    "cricket scoring app for local matches",
    "cricket scoring app for umpires and spectators",
    "mobile cricket scoring app",
  ],
  ogImagePath: "/opengraph-image?v=2026-03-20-logo",
  twitterImagePath: "/twitter-image?v=2026-03-20-logo",
};

export function getSiteUrl() {
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  const previewUrl = String(
    process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || ""
  ).trim();
  if (vercelEnv && vercelEnv !== "production" && previewUrl) {
    return previewUrl.startsWith("http") ? previewUrl : `https://${previewUrl}`;
  }

  const explicitUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (explicitUrl) {
    return explicitUrl.startsWith("http") ? explicitUrl : `https://${explicitUrl}`;
  }

  const productionUrl = String(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ""
  ).trim();
  if (productionUrl) {
    return productionUrl.startsWith("http") ? productionUrl : `https://${productionUrl}`;
  }

  return siteConfig.url;
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
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
