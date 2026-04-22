/**
 * File overview:
 * Purpose: Renders Session View UI for the app's screens and flows.
 * Main exports: navigateToSessions.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

export function navigateToSessions({ router, setIsLeavingToSessions, startNavigation }) {
  setIsLeavingToSessions(true);
  startNavigation("Opening sessions...");
  router.push("/session", { scroll: true });
}


