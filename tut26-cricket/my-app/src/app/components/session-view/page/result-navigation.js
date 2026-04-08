/**
 * File overview:
 * Purpose: Small navigation helpers for spectator result and session routing.
 * Main exports: navigateToSessions.
 * Major callers: SessionViewScreen.
 * Side effects: triggers client-side route navigation.
 * Read next: README.md
 */

export function navigateToSessions({ router, setIsLeavingToSessions, startNavigation }) {
  setIsLeavingToSessions(true);
  startNavigation("Opening sessions...");
  router.push("/session");
}
