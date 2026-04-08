/**
 * File overview:
 * Purpose: Shared helper module for Match Toss logic.
 * Main exports: getMatchTeamNames, getBattingFirstTeamName, getBowlingFirstTeamName, normalizeLegacyTossState, hasCompleteTossState, hydrateLegacyTossState.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import { getTeamBundle } from "./team-utils";

function sanitizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getResolvedTossWinner(match, fallbackState) {
  return sanitizeName(match?.tossWinner) || sanitizeName(fallbackState?.tossWinner);
}

function getResolvedTossDecision(match, fallbackState) {
  return sanitizeName(match?.tossDecision) || sanitizeName(fallbackState?.tossDecision);
}

function buildEmptyInnings(existing) {
  return {
    team: sanitizeName(existing?.team),
    score: Number(existing?.score || 0),
    history: Array.isArray(existing?.history) ? existing.history : [],
  };
}

export function getMatchTeamNames(match, fallbackState = null) {
  const fallbackMatch = fallbackState
    ? {
        teamA: fallbackState.teamA,
        teamB: fallbackState.teamB,
        teamAName: fallbackState.teamAName,
        teamBName: fallbackState.teamBName,
      }
    : null;
  const teamA = getTeamBundle(match?.teamAName || match?.teamA ? match : fallbackMatch, "teamA");
  const teamB = getTeamBundle(match?.teamBName || match?.teamB ? match : fallbackMatch, "teamB");

  return {
    teamAName: sanitizeName(teamA.name) || "Team A",
    teamBName: sanitizeName(teamB.name) || "Team B",
  };
}

export function getBattingFirstTeamName(match, fallbackState) {
  const tossWinner = getResolvedTossWinner(match, fallbackState);
  const tossDecision = getResolvedTossDecision(match, fallbackState);
  const { teamAName, teamBName } = getMatchTeamNames(match, fallbackState);

  if (!tossWinner || !tossDecision) {
    return "";
  }

  if (tossDecision === "bat") {
    return tossWinner;
  }

  if (tossWinner === teamAName) {
    return teamBName;
  }

  if (tossWinner === teamBName) {
    return teamAName;
  }

  return "";
}

export function getBowlingFirstTeamName(match, fallbackState) {
  const { teamAName, teamBName } = getMatchTeamNames(match, fallbackState);
  const battingFirst = getBattingFirstTeamName(match, fallbackState);

  if (!battingFirst) {
    return "";
  }

  if (battingFirst === teamAName) {
    return teamBName;
  }

  if (battingFirst === teamBName) {
    return teamAName;
  }

  return "";
}

export function normalizeLegacyTossState(match, fallbackState = null) {
  if (!match) {
    return match;
  }

  const tossWinner = getResolvedTossWinner(match, fallbackState);
  const tossDecision = getResolvedTossDecision(match, fallbackState);
  const battingFirst = getBattingFirstTeamName(
    { ...match, tossWinner, tossDecision },
    fallbackState
  );
  const bowlingFirst = getBowlingFirstTeamName(
    { ...match, tossWinner, tossDecision },
    fallbackState
  );
  const innings1 = buildEmptyInnings(match.innings1);
  const innings2 = buildEmptyInnings(match.innings2);

  if (!innings1.team && battingFirst) {
    innings1.team = battingFirst;
  }

  if (!innings2.team && bowlingFirst) {
    innings2.team = bowlingFirst;
  }

  return {
    ...match,
    tossWinner,
    tossDecision,
    innings1,
    innings2,
    tossReady: Boolean(
      tossWinner &&
        tossDecision &&
        innings1.team &&
        innings2.team
    ),
  };
}

export function hasCompleteTossState(match, fallbackState = null) {
  return Boolean(normalizeLegacyTossState(match, fallbackState)?.tossReady);
}

export function hydrateLegacyTossState(matchDocument, fallbackState = null) {
  if (!matchDocument) {
    return false;
  }

  const normalized = normalizeLegacyTossState(matchDocument, fallbackState);
  const tossWinnerChanged =
    sanitizeName(matchDocument?.tossWinner) !== sanitizeName(normalized?.tossWinner);
  const tossDecisionChanged =
    sanitizeName(matchDocument?.tossDecision) !== sanitizeName(normalized?.tossDecision);
  const innings1TeamChanged =
    sanitizeName(matchDocument?.innings1?.team) !== sanitizeName(normalized?.innings1?.team);
  const innings2TeamChanged =
    sanitizeName(matchDocument?.innings2?.team) !== sanitizeName(normalized?.innings2?.team);

  if (
    !tossWinnerChanged &&
    !tossDecisionChanged &&
    !innings1TeamChanged &&
    !innings2TeamChanged
  ) {
    return false;
  }

  matchDocument.tossWinner = normalized.tossWinner;
  matchDocument.tossDecision = normalized.tossDecision;
  matchDocument.innings1 = normalized.innings1;
  matchDocument.innings2 = normalized.innings2;
  return true;
}
