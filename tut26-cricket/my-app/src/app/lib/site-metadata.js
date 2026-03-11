export const siteConfig = {
  name: "GV Cricket",
  shortName: "GV Cricket",
  url: "https://gvcricket.com",
  description:
    "Free cricket scoring app with live score updates, umpire mode, spectator view, score announcer, walkie-talkie, match images, and final stats in one simple mobile-friendly flow.",
  defaultTitle:
    "GV Cricket - Free Cricket Scoring App with Live Score, Umpire Mode and Walkie-Talkie",
  ogTitle:
    "Free Cricket Scoring App with Live Score, Umpire Mode and Walkie-Talkie",
  keywords: [
    "free cricket scoring app",
    "free live cricket scoring app",
    "free cricket scorer",
    "cricket score app",
    "cricket walkie talkie app",
    "free umpire mode cricket app",
    "live cricket scorekeeper app",
    "cricket scoring app for local matches",
    "cricket scoring app for umpires and spectators",
    "mobile cricket scoring app",
  ],
  ogImagePath: "/opengraph-image",
  twitterImagePath: "/twitter-image",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
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
