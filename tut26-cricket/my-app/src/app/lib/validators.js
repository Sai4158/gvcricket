function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];
  return players
    .map((player) => (typeof player === "string" ? player.trim() : ""))
    .filter(Boolean);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return normalized;
}

function validateHistory(history) {
  if (!Array.isArray(history)) return false;

  return history.every((over, overIndex) => {
    if (
      typeof over !== "object" ||
      over === null ||
      typeof over.overNumber !== "number" ||
      over.overNumber < 1 ||
      !Array.isArray(over.balls)
    ) {
      return false;
    }

    return over.balls.every((ball) => {
      if (typeof ball !== "object" || ball === null) return false;
      if (typeof ball.runs !== "number" || ball.runs < 0 || ball.runs > 7) {
        return false;
      }
      if (typeof ball.isOut !== "boolean") return false;
      if (
        ball.extraType !== null &&
        ball.extraType !== undefined &&
        !["wide", "noball", "byes", "legbyes", ""].includes(ball.extraType)
      ) {
        return false;
      }
      if (
        ball.batsmanOnStrike !== undefined &&
        typeof ball.batsmanOnStrike !== "string"
      ) {
        return false;
      }
      return true;
    });
  });
}

function validateInnings(innings) {
  if (typeof innings !== "object" || innings === null) return false;
  if (innings.team !== undefined && typeof innings.team !== "string") return false;
  if (typeof innings.score !== "number" || innings.score < 0) return false;
  if (!validateHistory(innings.history || [])) return false;
  return true;
}

export function validateSessionCreatePayload(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }

  if (!isNonEmptyString(body.name)) {
    return { ok: false, message: "Session name is required." };
  }

  if (body.date !== undefined && typeof body.date !== "string") {
    return { ok: false, message: "Date must be a string." };
  }

  return {
    ok: true,
    value: {
      name: body.name.trim(),
      date: typeof body.date === "string" ? body.date.trim() : "",
    },
  };
}

export function validateSetupMatchPayload(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }

  const normalized = {
    teamAName: typeof body.teamAName === "string" ? body.teamAName.trim() : "",
    teamBName: typeof body.teamBName === "string" ? body.teamBName.trim() : "",
    teamAPlayers: normalizePlayers(body.teamAPlayers),
    teamBPlayers: normalizePlayers(body.teamBPlayers),
    overs: Number(body.overs),
  };

  if (!normalized.teamAName || !normalized.teamBName) {
    return { ok: false, message: "Each team must have a name." };
  }

  if (!normalized.teamAPlayers.length || !normalized.teamBPlayers.length) {
    return { ok: false, message: "Each team must have at least one player." };
  }

  if (!Number.isInteger(normalized.overs) || normalized.overs < 1 || normalized.overs > 50) {
    return { ok: false, message: "Overs must be a whole number between 1 and 50." };
  }

  return { ok: true, value: normalized };
}

export function validatePinPayload(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }

  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  if (!pin) {
    return { ok: false, message: "PIN is required." };
  }

  if (pin.length > 64) {
    return { ok: false, message: "PIN is invalid." };
  }

  return { ok: true, value: { pin } };
}

export function validateSessionPatchPayload(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }

  const allowed = {};

  if ("name" in body) {
    if (!isNonEmptyString(body.name)) {
      return { ok: false, message: "Session name must be a non-empty string." };
    }
    allowed.name = body.name.trim();
  }

  if ("date" in body) {
    if (typeof body.date !== "string") {
      return { ok: false, message: "Session date must be a string." };
    }
    allowed.date = body.date.trim();
  }

  if ("isLive" in body) {
    if (typeof body.isLive !== "boolean") {
      return { ok: false, message: "Session live state must be boolean." };
    }
    allowed.isLive = body.isLive;
  }

  if ("overs" in body) {
    if (
      body.overs !== null &&
      (!Number.isInteger(body.overs) || body.overs < 1 || body.overs > 50)
    ) {
      return { ok: false, message: "Session overs must be 1 to 50." };
    }
    allowed.overs = body.overs;
  }

  if ("teamAName" in body) {
    if (typeof body.teamAName !== "string") {
      return { ok: false, message: "Team A name must be a string." };
    }
    allowed.teamAName = body.teamAName.trim();
  }

  if ("teamBName" in body) {
    if (typeof body.teamBName !== "string") {
      return { ok: false, message: "Team B name must be a string." };
    }
    allowed.teamBName = body.teamBName.trim();
  }

  if ("teamA" in body) {
    const players = normalizePlayers(body.teamA);
    if (!players.length) {
      return { ok: false, message: "Team A must include at least one player." };
    }
    allowed.teamA = players;
  }

  if ("teamB" in body) {
    const players = normalizePlayers(body.teamB);
    if (!players.length) {
      return { ok: false, message: "Team B must include at least one player." };
    }
    allowed.teamB = players;
  }

  if ("tossWinner" in body) {
    if (typeof body.tossWinner !== "string") {
      return { ok: false, message: "Toss winner must be a string." };
    }
    allowed.tossWinner = body.tossWinner.trim();
  }

  if ("images" in body) {
    const images = normalizeStringArray(body.images);
    if (!images) {
      return { ok: false, message: "images must be an array of strings." };
    }
    allowed.images = images;
    allowed.mediaUpdatedAt = new Date();
  }

  if ("announcer" in body) {
    if (!isPlainObject(body.announcer)) {
      return { ok: false, message: "announcer must be an object." };
    }
    allowed.announcer = body.announcer;
  }

  if ("uiMeta" in body) {
    if (!isPlainObject(body.uiMeta)) {
      return { ok: false, message: "uiMeta must be an object." };
    }
    allowed.uiMeta = body.uiMeta;
  }

  if ("lastLiveEvent" in body) {
    if (body.lastLiveEvent !== null && !isPlainObject(body.lastLiveEvent)) {
      return { ok: false, message: "lastLiveEvent must be an object or null." };
    }
    allowed.lastLiveEvent = body.lastLiveEvent;
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, message: "No valid session fields provided." };
  }

  return { ok: true, value: allowed };
}

export function validateMatchPatchPayload(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid request body." };
  }

  const allowed = {};

  const numericFields = ["score", "outs", "overs"];
  for (const field of numericFields) {
    if (field in body) {
      if (!Number.isInteger(body[field]) || body[field] < 0) {
        return { ok: false, message: `${field} must be a non-negative integer.` };
      }
      allowed[field] = body[field];
    }
  }

  if ("result" in body) {
    if (typeof body.result !== "string") {
      return { ok: false, message: "result must be a string." };
    }
    allowed.result = body.result;
  }

  if ("isOngoing" in body) {
    if (typeof body.isOngoing !== "boolean") {
      return { ok: false, message: "isOngoing must be boolean." };
    }
    allowed.isOngoing = body.isOngoing;
  }

  if ("innings" in body) {
    if (!["first", "second"].includes(body.innings)) {
      return { ok: false, message: "innings must be first or second." };
    }
    allowed.innings = body.innings;
  }

  if ("tossWinner" in body) {
    if (typeof body.tossWinner !== "string") {
      return { ok: false, message: "tossWinner must be a string." };
    }
    allowed.tossWinner = body.tossWinner.trim();
  }

  if ("tossDecision" in body) {
    if (!["bat", "bowl", ""].includes(body.tossDecision)) {
      return { ok: false, message: "tossDecision must be bat or bowl." };
    }
    allowed.tossDecision = body.tossDecision;
  }

  if ("teamAName" in body) {
    if (typeof body.teamAName !== "string") {
      return { ok: false, message: "teamAName must be a string." };
    }
    allowed.teamAName = body.teamAName.trim();
  }

  if ("teamBName" in body) {
    if (typeof body.teamBName !== "string") {
      return { ok: false, message: "teamBName must be a string." };
    }
    allowed.teamBName = body.teamBName.trim();
  }

  if ("teamA" in body) {
    const players = normalizePlayers(body.teamA);
    if (!players.length) {
      return { ok: false, message: "teamA must include at least one player." };
    }
    allowed.teamA = players;
  }

  if ("teamB" in body) {
    const players = normalizePlayers(body.teamB);
    if (!players.length) {
      return { ok: false, message: "teamB must include at least one player." };
    }
    allowed.teamB = players;
  }

  if ("balls" in body) {
    if (!Array.isArray(body.balls)) {
      return { ok: false, message: "balls must be an array." };
    }
    allowed.balls = body.balls;
  }

  if ("images" in body) {
    const images = normalizeStringArray(body.images);
    if (!images) {
      return { ok: false, message: "images must be an array of strings." };
    }
    allowed.images = images;
    allowed.mediaUpdatedAt = new Date();
  }

  if ("announcer" in body) {
    if (!isPlainObject(body.announcer)) {
      return { ok: false, message: "announcer must be an object." };
    }
    allowed.announcer = body.announcer;
  }

  if ("uiMeta" in body) {
    if (!isPlainObject(body.uiMeta)) {
      return { ok: false, message: "uiMeta must be an object." };
    }
    allowed.uiMeta = body.uiMeta;
  }

  if ("innings1" in body) {
    if (!validateInnings(body.innings1)) {
      return { ok: false, message: "innings1 is invalid." };
    }
    allowed.innings1 = body.innings1;
  }

  if ("innings2" in body) {
    if (!validateInnings(body.innings2)) {
      return { ok: false, message: "innings2 is invalid." };
    }
    allowed.innings2 = body.innings2;
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, message: "No valid updatable fields provided." };
  }

  return { ok: true, value: allowed };
}
