/**
 * File overview:
 * Purpose: UI component for Session View screens and flows.
 * Main exports: calculateRunRate.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: README.md
 */
import { countLegalBalls } from "../../lib/match-scoring";

export function calculateRunRate(score, history) {
  const legalBalls = countLegalBalls(history);
  if (!legalBalls || !score) return "0.00";
  return (score / (legalBalls / 6)).toFixed(2);
}
