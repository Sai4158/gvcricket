/**
 * File overview:
 * Purpose: Shared helper module for Result Insights logic.
 * Main exports: getBallDisplayLabel, buildInningsInsights, buildResultInsights.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: README.md
 */
import {
  calculateTrackedPlayerStats,
  hasTrackedPlayerStats,
} from "./match-stats";
import { countLegalBalls } from "./match-scoring";
import { getTeamBundle } from "./team-utils";

function toNumber(value) {
  return Number(value || 0);
}

function formatOverBall(overNumber, ballNumber) {
  return `${overNumber}.${ballNumber}`;
}

export function getBallDisplayLabel(ball) {
  if (!ball) return "-";
  if (ball.isOut && toNumber(ball.runs) > 0) {
    return `${ball.runs}+W`;
  }
  if (ball.isOut) return "W";
  if (ball.extraType === "wide") {
    return toNumber(ball.runs) > 0 ? `Wd+${ball.runs}` : "Wd";
  }
  if (ball.extraType === "noball") {
    return toNumber(ball.runs) > 0 ? `NB+${ball.runs}` : "NB";
  }
  if (ball.extraType === "byes") {
    return toNumber(ball.runs) > 0 ? `B${ball.runs}` : "B";
  }
  if (ball.extraType === "legbyes") {
    return toNumber(ball.runs) > 0 ? `LB${ball.runs}` : "LB";
  }
  if (toNumber(ball.runs) === 0) return "Dot";
  return String(ball.runs);
}

function getResultMomentLabel(ball) {
  if (ball?.isOut) return "Wicket";
  if (ball?.extraType === "wide") return "Wide";
  if (ball?.extraType === "noball") return "No ball";
  if (ball?.extraType === "byes") return "Byes";
  if (ball?.extraType === "legbyes") return "Leg byes";
  if (toNumber(ball?.runs) === 0) return "Dot";
  return `${ball.runs} run${toNumber(ball.runs) === 1 ? "" : "s"}`;
}

export function buildInningsInsights(innings) {
  const history = innings?.history || [];
  const allBalls = history.flatMap((over) => over?.balls || []);
  const wickets = allBalls.filter((ball) => ball?.isOut).length;
  const legalBalls = countLegalBalls(history);
  const fours = allBalls.filter((ball) => toNumber(ball?.runs) === 4).length;
  const sixes = allBalls.filter((ball) => toNumber(ball?.runs) === 6).length;
  const wideRuns = allBalls
    .filter((ball) => ball?.extraType === "wide")
    .reduce((total, ball) => total + toNumber(ball?.runs), 0);
  const noBallRuns = allBalls
    .filter((ball) => ball?.extraType === "noball")
    .reduce((total, ball) => total + toNumber(ball?.runs), 0);
  const otherExtras = allBalls
    .filter((ball) => ball?.extraType === "byes" || ball?.extraType === "legbyes")
    .reduce((total, ball) => total + toNumber(ball?.runs), 0);
  const extras = wideRuns + noBallRuns + otherExtras;
  const dotBalls = allBalls.filter(
    (ball) =>
      !ball?.isOut &&
      !ball?.extraType &&
      toNumber(ball?.runs) === 0
  ).length;
  const boundaries = fours + sixes;
  const runRate =
    legalBalls > 0 ? ((toNumber(innings?.score) / legalBalls) * 6).toFixed(2) : "0.00";

  const ballTimeline = [];
  const overSummaries = [];
  const wicketTimeline = [];

  history.forEach((over) => {
    const overRuns = (over?.balls || []).reduce(
      (total, ball) => total + toNumber(ball?.runs),
      0
    );
    const overWickets = (over?.balls || []).filter((ball) => ball?.isOut).length;

    overSummaries.push({
      over: over?.overNumber || overSummaries.length + 1,
      runs: overRuns,
      wickets: overWickets,
      label: `Over ${over?.overNumber || overSummaries.length + 1}`,
      summary: `${overRuns} runs${overWickets ? `, ${overWickets} wicket${overWickets === 1 ? "" : "s"}` : ""}`,
    });

    (over?.balls || []).forEach((ball, index) => {
      const point = {
        over: over?.overNumber || 0,
        ball: index + 1,
        overBall: formatOverBall(over?.overNumber || 0, index + 1),
        label: getBallDisplayLabel(ball),
        detail: getResultMomentLabel(ball),
        runs: toNumber(ball?.runs),
        isOut: Boolean(ball?.isOut),
      };
      ballTimeline.push(point);

      if (ball?.isOut) {
        wicketTimeline.push({
          overBall: point.overBall,
          detail:
            point.runs > 0
              ? `Wicket fell after ${point.runs} run${point.runs === 1 ? "" : "s"}`
              : "Wicket fell",
        });
      }
    });
  });

  return {
    team: innings?.team || "",
    score: toNumber(innings?.score),
    wickets,
    runRate,
    legalBalls,
    boundaries,
    fours,
    sixes,
    extras,
    wideRuns,
    noBallRuns,
    otherExtras,
    dotBalls,
    ballTimeline,
    overSummaries,
    wicketTimeline,
  };
}

function buildTrackedCollections(match) {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1Players =
    match?.innings1?.team === teamB.name ? teamB.players : teamA.players;
  const innings2Players =
    match?.innings2?.team === teamA.name ? teamA.players : teamB.players;

  return {
    hasTracking:
      hasTrackedPlayerStats(match?.innings1) || hasTrackedPlayerStats(match?.innings2),
    innings1Tracked: calculateTrackedPlayerStats(match?.innings1, innings1Players),
    innings2Tracked: calculateTrackedPlayerStats(match?.innings2, innings2Players),
  };
}

function getBestValue(items, scorer) {
  if (!items.length) return null;

  return [...items].sort((a, b) => scorer(b) - scorer(a))[0] || null;
}

export function buildResultInsights(match) {
  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const innings1 = buildInningsInsights(match?.innings1);
  const innings2 = buildInningsInsights(match?.innings2);
  const tracked = buildTrackedCollections(match);

  const battingStats = [
    ...(tracked.innings1Tracked?.battingStats || []),
    ...(tracked.innings2Tracked?.battingStats || []),
  ].filter((player) => toNumber(player?.balls) > 0 || toNumber(player?.runs) > 0);

  const bowlingStats = [
    ...(tracked.innings1Tracked?.bowlingStats || []),
    ...(tracked.innings2Tracked?.bowlingStats || []),
  ].filter(
    (player) => toNumber(player?.ballsBowled) > 0 || toNumber(player?.wickets) > 0
  );

  const topScorer = getBestValue(battingStats, (player) => toNumber(player?.runs));
  const bestStrikeRate = getBestValue(
    battingStats.filter((player) => toNumber(player?.balls) > 0),
    (player) => Number(player?.strikeRate || 0)
  );
  const bestBowler = [...bowlingStats].sort((a, b) => {
    const wicketGap = toNumber(b?.wickets) - toNumber(a?.wickets);
    if (wicketGap !== 0) return wicketGap;
    return Number(a?.economy || 99) - Number(b?.economy || 99);
  })[0] || null;
  const bestEconomy = [...bowlingStats]
    .filter((player) => toNumber(player?.ballsBowled) > 0)
    .sort((a, b) => Number(a?.economy || 99) - Number(b?.economy || 99))[0] || null;

  const playerImpact = new Map();
  battingStats.forEach((player) => {
    const current = playerImpact.get(player.name) || { name: player.name, score: 0 };
    current.score += toNumber(player.runs) + toNumber(player.fours) + toNumber(player.sixes) * 2;
    playerImpact.set(player.name, current);
  });
  bowlingStats.forEach((player) => {
    const current = playerImpact.get(player.name) || { name: player.name, score: 0 };
    current.score += toNumber(player.wickets) * 22;
    current.score += Math.max(0, 8 - Number(player.economy || 8));
    playerImpact.set(player.name, current);
  });

  const playerOfMatch =
    [...playerImpact.values()].sort((a, b) => b.score - a.score)[0]?.name || "";

  const winnerName =
    match?.result?.split(" won ")[0] ||
    (toNumber(match?.innings2?.score) > toNumber(match?.innings1?.score)
      ? match?.innings2?.team
      : match?.innings1?.team);

  const bestMoment = match?.result
    ? `Result sealed: ${match.result}`
    : innings2.wicketTimeline[0]?.detail || innings1.overSummaries[0]?.summary || "";

  const turningPoint = (() => {
    if (toNumber(match?.innings2?.score) > toNumber(match?.innings1?.score)) {
      const chasePoint = innings2.ballTimeline.find(
        (_, index) =>
          innings2.ballTimeline
            .slice(0, index + 1)
            .reduce((total, ball) => total + toNumber(ball.runs), 0) >
          toNumber(match?.innings1?.score)
      );
      if (chasePoint) {
        return `Winning runs came at ${chasePoint.overBall}. ${innings2.team} completed the chase there.`;
      }
    }

    if (innings2.wicketTimeline.length) {
      const latestWicket = innings2.wicketTimeline[innings2.wicketTimeline.length - 1];
      return `Key wicket fell at ${latestWicket.overBall}. ${latestWicket.detail}.`;
    }

    const biggestOver = [...innings1.overSummaries, ...innings2.overSummaries].sort(
      (a, b) => b.runs - a.runs
    )[0];
    if (biggestOver) {
      return `${biggestOver.label} shifted momentum with ${biggestOver.summary}.`;
    }

    return "The match stayed controlled from the first over to the last.";
  })();

  return {
    teamA,
    teamB,
    innings1,
    innings2,
    tracked: tracked.hasTracking,
    topPerformers: {
      topScorer,
      bestBowler,
      bestStrikeRate,
      bestEconomy,
      playerOfMatch: playerOfMatch || winnerName || "Not available",
    },
    awards: {
      playerOfMatch: playerOfMatch || winnerName || "Not available",
      bestBatter: topScorer?.name || "Not tracked",
      bestBowler: bestBowler?.name || "Not tracked",
      bestMoment,
    },
    turningPoint,
  };
}
