import { getBattingTeamBundle, getTotalDismissalsAllowed } from "./team-utils";

export function countLegalBalls(history = []) {
  return history
    .flatMap((over) => over.balls || [])
    .filter((ball) => ball.extraType !== "wide" && ball.extraType !== "noball")
    .length;
}

export function addBallToHistory(match, ball) {
  const activeInningsKey = match.innings === "first" ? "innings1" : "innings2";
  const innings = match[activeInningsKey];

  if (!innings.history) innings.history = [];

  const history = innings.history;
  const lastOver = history.at(-1);
  const legalBallsInLastOver = countLegalBalls(lastOver ? [lastOver] : []);

  // Once an over already has 6 legal balls, any next scoring event belongs
  // to the next over, including wides and no-balls.
  if (!lastOver || legalBallsInLastOver >= 6) {
    history.push({
      overNumber: (lastOver?.overNumber ?? 0) + 1,
      balls: [ball],
    });
    return;
  }

  lastOver.balls.push(ball);
}

export function buildWinByWicketsText(match, outs) {
  const battingTeam = getBattingTeamBundle(match);
  const wicketsLeft = Math.max(getTotalDismissalsAllowed(match) - outs, 1);

  return `${battingTeam.name} won by ${wicketsLeft} ${
    wicketsLeft === 1 ? "wicket" : "wickets"
  }.`;
}

export function syncTeamNamesAcrossMatch(match, previousNames, nextNames) {
  const updated = structuredClone(match);

  if (updated.tossWinner === previousNames.teamAName) {
    updated.tossWinner = nextNames.teamAName;
  } else if (updated.tossWinner === previousNames.teamBName) {
    updated.tossWinner = nextNames.teamBName;
  }

  if (updated.innings1?.team === previousNames.teamAName) {
    updated.innings1.team = nextNames.teamAName;
  } else if (updated.innings1?.team === previousNames.teamBName) {
    updated.innings1.team = nextNames.teamBName;
  }

  if (updated.innings2?.team === previousNames.teamAName) {
    updated.innings2.team = nextNames.teamAName;
  } else if (updated.innings2?.team === previousNames.teamBName) {
    updated.innings2.team = nextNames.teamBName;
  }

  return updated;
}
