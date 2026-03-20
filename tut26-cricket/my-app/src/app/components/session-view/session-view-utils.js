import { countLegalBalls } from "../../lib/match-scoring";

export function calculateRunRate(score, history) {
  const legalBalls = countLegalBalls(history);
  if (!legalBalls || !score) return "0.00";
  return (score / (legalBalls / 6)).toFixed(2);
}
