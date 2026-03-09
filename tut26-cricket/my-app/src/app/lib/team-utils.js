const TEAM_LABELS = {
  teamA: "Team A",
  teamB: "Team B",
};

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeArray(values) {
  return Array.isArray(values)
    ? values.map((value) => sanitizeString(value)).filter(Boolean)
    : [];
}

function isLegacyRoster(entity, key) {
  return !sanitizeString(entity?.[`${key}Name`]);
}

export function getTeamBundle(entity, key) {
  const fallbackName = TEAM_LABELS[key] || "Team";
  const nameField = sanitizeString(entity?.[`${key}Name`]);
  const roster = sanitizeArray(entity?.[key]);

  if (nameField) {
    return {
      key,
      name: nameField,
      players: roster,
      lineup: [nameField, ...roster],
      isLegacy: false,
    };
  }

  const [legacyName, ...legacyPlayers] = roster;

  return {
    key,
    name: legacyName || fallbackName,
    players: legacyPlayers,
    lineup: roster.length ? roster : [fallbackName],
    isLegacy: isLegacyRoster(entity, key),
  };
}

export function buildTeamUpdate(name, players) {
  const safeName = sanitizeString(name);
  const safePlayers = sanitizeArray(players);

  return {
    name: safeName,
    players: safePlayers,
    legacyLineup: safeName ? [safeName, ...safePlayers] : safePlayers,
  };
}

export function getTeamByName(entity, teamName) {
  const normalizedName = sanitizeString(teamName);
  const teamA = getTeamBundle(entity, "teamA");
  const teamB = getTeamBundle(entity, "teamB");

  if (teamA.name === normalizedName) return teamA;
  if (teamB.name === normalizedName) return teamB;

  return null;
}

export function getBattingTeamBundle(match) {
  const battingName =
    match?.innings === "second" ? match?.innings2?.team : match?.innings1?.team;

  return getTeamByName(match, battingName) || getTeamBundle(match, "teamA");
}

export function getPlayerCount(entity, key) {
  return getTeamBundle(entity, key).players.length;
}

export function getTotalDismissalsAllowed(match) {
  const playerCount = getBattingTeamBundle(match).players.length;
  return Math.max(1, playerCount - 1);
}
