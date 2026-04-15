/**
 * File overview:
 * Purpose: Renders Session UI for the app's screens and flows.
 * Main exports: formatRelativeTime.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

export function formatRelativeTime(dateString) {
  if (!dateString) return "some time ago";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "some time ago";

  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return `on ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}


