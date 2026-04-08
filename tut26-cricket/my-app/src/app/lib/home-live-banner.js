/**
 * File overview:
 * Purpose: Shared helper module for Home Live Banner logic.
 * Main exports: HOME_LIVE_BANNER_MATCH_FILTER.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
export const HOME_LIVE_BANNER_MATCH_FILTER = {
  isOngoing: true,
  $or: [{ result: "" }, { result: null }],
};
