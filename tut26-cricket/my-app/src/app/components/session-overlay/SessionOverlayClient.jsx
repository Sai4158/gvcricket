"use client";

/**
 * File overview:
 * Purpose: Renders a broadcast-grade live score overlay for OBS and mobile streaming.
 * Main exports: SessionOverlayClient.
 * Major callers: Session overlay route.
 * Side effects: uses React hooks and browser EventSource updates.
 * Read next: ../session-view/page/stream-hydration.js
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import useEventSource from "../live/useEventSource";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import { applySessionStreamPayload } from "../session-view/page/stream-hydration";
import { getBattingTeamBundle, getTeamBundle } from "../../lib/team-utils";
import { isTiedMatchResult } from "../../lib/match-result-display";
import { buildLiveScoreAnnouncementSequence } from "../../lib/live-announcements";
import {
  calculateInningsSummary,
  calculateTrackedPlayerStats,
} from "../../lib/match-stats";

function formatOversFromBalls(legalBallCount) {
  const safeBalls = Math.max(0, Number(legalBallCount || 0));
  return `${Math.floor(safeBalls / 6)}.${safeBalls % 6}`;
}

function buildOverlaySignature(payload) {
  return JSON.stringify(payload || null);
}

function shortenTeamName(value = "") {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return "TEAM";
  }

  return safeValue.toUpperCase();
}

function compactLabel(value = "", maxLength = 18) {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return "";
  }

  if (safeValue.length <= maxLength) {
    return safeValue;
  }

  return `${safeValue.slice(0, maxLength - 1).trimEnd()}...`;
}

function buildStatusText(match) {
  if (!match) {
    return "";
  }

  if (match.result) {
    return String(match.result).trim();
  }

  if (match.pendingResult) {
    return `Result pending: ${String(match.pendingResult).trim()}`;
  }

  if (match.isOngoing) {
    return "Live match";
  }

  return "Waiting for next match";
}

function buildInningsSummary(match, teamA, teamB) {
  if (!match) {
    return [];
  }

  return [
    {
      key: "innings1",
      label: teamA.name,
      score: Number(match?.innings1?.score || 0),
    },
    {
      key: "innings2",
      label: teamB.name,
      score: Number(match?.innings2?.score || 0),
    },
  ];
}

function buildTopRightText(match, targetRuns, chaseRunsLeft, chaseWicketsLeft) {
  if (!match) {
    return "";
  }

  if (match.result) {
    return String(match.result).trim();
  }

  if (match.pendingResult) {
    return String(match.pendingResult).trim();
  }

  if (targetRuns > 0) {
    return `${chaseRunsLeft} needed | ${chaseWicketsLeft} wkts`;
  }

  return `${Number(match.overs || 0)} overs`;
}

function getScenarioLabel(match, targetRuns, chaseRunsLeft) {
  const eventType = String(match?.lastLiveEvent?.type || "").trim();
  const resultText = String(match?.result || "").trim();

  if (resultText && isTiedMatchResult(resultText)) {
    return "MATCH TIED";
  }

  if (eventType === "innings_change") {
    return "INNINGS BREAK";
  }

  if (eventType === "target_chased") {
    return "CHASE COMPLETE";
  }

  if (eventType === "match_end" || resultText) {
    return "MATCH COMPLETE";
  }

  if (targetRuns > 0) {
    return chaseRunsLeft <= 12 ? "CHASE ON" : "RUNS TO WIN";
  }

  return "LIVE";
}

function getScenarioMessage(
  match,
  { targetRuns, chaseRunsLeft, chaseWicketsLeft, oversText },
) {
  const eventType = String(match?.lastLiveEvent?.type || "").trim();
  const resultText = String(match?.result || "").trim();
  const innings1Team = String(
    match?.innings1?.team || match?.teamAName || "Team 1",
  ).trim();
  const innings1Score = Number(match?.innings1?.score || 0);
  const innings2Team = String(
    match?.innings2?.team || match?.teamBName || "Team 2",
  ).trim();

  if (resultText && isTiedMatchResult(resultText)) {
    return "Match tied. Scores level at the end of play.";
  }

  if (eventType === "innings_change") {
    return `${innings1Team} finished on ${innings1Score}. ${innings2Team} begins the chase.`;
  }

  if (eventType === "target_chased") {
    return resultText || `${innings2Team} chased the target successfully.`;
  }

  if (eventType === "match_end" || resultText) {
    return resultText || "Match complete.";
  }

  if (targetRuns > 0) {
    if (chaseRunsLeft <= 0) {
      return `${innings2Team} has reached the target.`;
    }

    return `${chaseRunsLeft} runs to win with ${chaseWicketsLeft} wickets left.`;
  }

  return `${innings1Team} batting ${Number(match?.score || 0)}/${Number(match?.outs || 0)} after ${oversText} overs.`;
}

function calculateRunRateFromBalls(score, legalBallCount) {
  const safeBalls = Math.max(0, Number(legalBallCount || 0));
  if (!safeBalls) {
    return "0.00";
  }

  return ((Number(score || 0) / safeBalls) * 6).toFixed(2);
}

function getCurrentOverBowler(match) {
  const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const history = Array.isArray(match?.[inningsKey]?.history)
    ? match[inningsKey].history
    : [];
  const activeOverNumber = Number(match?.activeOverNumber || 0);
  const currentOver =
    history.find(
      (over) => Number(over?.overNumber || 0) === activeOverNumber,
    ) ||
    history.at(-1) ||
    null;

  return String(currentOver?.bowler || "").trim();
}

function getCurrentStriker(match) {
  const balls = Array.isArray(match?.activeOverBalls)
    ? match.activeOverBalls
    : [];
  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const name = String(balls[index]?.batsmanOnStrike || "").trim();
    if (name) {
      return name;
    }
  }

  const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
  const history = Array.isArray(match?.[inningsKey]?.history)
    ? match[inningsKey].history
    : [];

  for (let overIndex = history.length - 1; overIndex >= 0; overIndex -= 1) {
    const overBalls = Array.isArray(history[overIndex]?.balls)
      ? history[overIndex].balls
      : [];
    for (let ballIndex = overBalls.length - 1; ballIndex >= 0; ballIndex -= 1) {
      const name = String(overBalls[ballIndex]?.batsmanOnStrike || "").trim();
      if (name) {
        return name;
      }
    }
  }

  return "";
}

function getActiveInningsHistory(match) {
  const inningsKey = match?.innings === "second" ? "innings2" : "innings1";
  return Array.isArray(match?.[inningsKey]?.history)
    ? match[inningsKey].history
    : [];
}

function getCurrentOverSummary(match) {
  const balls = Array.isArray(match?.activeOverBalls)
    ? match.activeOverBalls
    : [];
  if (!balls.length) {
    return [];
  }

  let legalCount = 0;
  return balls.map((ball) => {
    const runs = Number(ball?.runs || 0);
    const isWide = ball?.extraType === "wide";
    const isNoBall = ball?.extraType === "noball";
    const isExtra = isWide || isNoBall;

    if (ball?.extraType === "wide") {
      return { top: "Wd", bottom: ".", type: "extra" };
    }
    if (ball?.extraType === "noball") {
      return { top: "Nb", bottom: ".", type: "extra" };
    }

    if (!isExtra) {
      legalCount += 1;
    }

    if (ball?.isOut) {
      return {
        top: runs > 0 ? `${runs}W` : "W",
        bottom: String(legalCount),
        type: "wicket",
      };
    }

    if (runs === 0) {
      return { top: ".", bottom: String(legalCount), type: "dot" };
    }

    return {
      top: String(runs),
      bottom: String(legalCount),
      type: runs >= 6 ? "six" : runs >= 4 ? "four" : "run",
    };
  });
}

function buildOverBallSummary(balls = []) {
  let legalCount = 0;
  return balls.map((ball) => {
    const runs = Number(ball?.runs || 0);
    const isWide = ball?.extraType === "wide";
    const isNoBall = ball?.extraType === "noball";

    if (isWide) {
      return "Wd";
    }
    if (isNoBall) {
      return "Nb";
    }

    legalCount += 1;

    if (ball?.isOut) {
      return runs > 0 ? `${runs}W` : "W";
    }
    if (runs === 0) {
      return ".";
    }

    return String(runs);
  });
}

function getRecentOversDisplay(match) {
  const history = getActiveInningsHistory(match);
  if (!history.length) {
    return [];
  }

  const recentOvers = history
    .slice(-2)
    .map((over) => {
      const overNumber = Number(over?.overNumber || 0);
      const balls = Array.isArray(over?.balls) ? over.balls : [];
      const totals = balls.reduce(
        (summary, ball) => {
          const runs = Number(ball?.runs || 0);
          const extraRun =
            ball?.extraType === "wide" || ball?.extraType === "noball" ? 1 : 0;
          return {
            runs: summary.runs + runs + extraRun,
            wickets: summary.wickets + (ball?.isOut ? 1 : 0),
          };
        },
        { runs: 0, wickets: 0 },
      );

      return {
        overNumber,
        values: buildOverBallSummary(balls),
        runs: totals.runs,
        wickets: totals.wickets,
      };
    })
    .reverse();

  return recentOvers;
}

function countBallsLeftInOver(match) {
  const balls = Array.isArray(match?.activeOverBalls)
    ? match.activeOverBalls
    : [];
  const legalBalls = balls.reduce((total, ball) => {
    return ball?.extraType === "wide" || ball?.extraType === "noball"
      ? total
      : total + 1;
  }, 0);
  return Math.max(6 - legalBalls, 0);
}

function countInningsBallsLeft(match) {
  const inningsLimit = Math.max(0, Number(match?.overs || 0) * 6);
  if (!inningsLimit) {
    return 0;
  }

  return Math.max(inningsLimit - Number(match?.legalBallCount || 0), 0);
}

function calculateRequiredRate(runsLeft, ballsLeft) {
  const safeBallsLeft = Math.max(0, Number(ballsLeft || 0));
  if (!safeBallsLeft) {
    return runsLeft > 0 ? "INF" : "0.00";
  }

  return ((Number(runsLeft || 0) / safeBallsLeft) * 6).toFixed(2);
}

function calculateOverTotals(match) {
  const balls = Array.isArray(match?.activeOverBalls)
    ? match.activeOverBalls
    : [];
  return balls.reduce(
    (totals, ball) => {
      const baseRuns = Number(ball?.runs || 0);
      const extraRun =
        ball?.extraType === "wide" || ball?.extraType === "noball" ? 1 : 0;
      return {
        runs: totals.runs + baseRuns + extraRun,
        wickets: totals.wickets + (ball?.isOut ? 1 : 0),
      };
    },
    { runs: 0, wickets: 0 },
  );
}

function buildOverPopup(match, targetRuns, chaseRunsLeft, ballsLeft) {
  if (!match?.lastLiveEvent?.overCompleted) {
    return null;
  }

  const overTotals = calculateOverTotals(match);
  const overLabel =
    Number(match?.activeOverNumber || 0) ||
    Math.ceil(Number(match?.legalBallCount || 0) / 6);
  const score = Number(match?.score || 0);
  const wickets = Number(match?.outs || 0);
  const totalOvers = Number(match?.overs || 0);
  const chaseText =
    targetRuns > 0
      ? `${chaseRunsLeft} needed from ${ballsLeft} balls`
      : `${Math.max(totalOvers * 6 - Number(match?.legalBallCount || 0), 0)} balls left`;

  return {
    key: `over-${match.lastLiveEvent.id}`,
    eyebrow: `Over ${overLabel} complete`,
    title: `${score}/${wickets}`,
    meta: `${overTotals.runs} runs in the over`,
    detail: chaseText,
    summaryLeft: `${overTotals.wickets} wicket${overTotals.wickets === 1 ? "" : "s"}`,
    summaryRight: `${totalOvers} overs match`,
    type: "over",
  };
}

function buildResultPopup(match, winnerName) {
  const resultText = String(match?.result || "").trim();
  if (!resultText && match?.lastLiveEvent?.type !== "target_chased") {
    return null;
  }

  if (resultText && isTiedMatchResult(resultText)) {
    return {
      key: `result-${match?._id || "match"}-${resultText}`,
      eyebrow: "Match complete",
      title: "Match tied",
      meta: resultText,
      detail: "Scores level at the end of play",
      type: "result",
    };
  }

  return {
    key: `result-${match?._id || "match"}-${resultText || match?.lastLiveEvent?.id}`,
    eyebrow: "Match complete",
    title: winnerName ? `Congrats ${winnerName}` : "Result confirmed",
    meta: resultText || "Target chased",
    detail: "Final result",
    type: "result",
  };
}

function buildInningsPopup(match) {
  if (match?.lastLiveEvent?.type !== "innings_change") {
    return null;
  }

  const firstInningsTeam = String(
    match?.innings1?.team || match?.teamAName || "First innings",
  ).trim();
  const chasingTeam = String(
    match?.innings2?.team || match?.teamBName || "Chasing team",
  ).trim();
  const firstScore = Number(match?.innings1?.score ?? match?.score ?? 0);
  const firstOuts = Number(match?.innings1?.outs ?? match?.outs ?? 0);
  const target = firstScore + 1;

  return {
    key: `innings-${match?.lastLiveEvent?.id || match?._id || "break"}`,
    eyebrow: "Innings break",
    title: `${firstInningsTeam} ${firstScore}/${firstOuts}`,
    meta: `${chasingTeam} need ${target}`,
    detail: "Second innings target set",
    type: "innings",
  };
}

function buildTossDecisionText(decision = "") {
  const safeDecision = String(decision || "")
    .trim()
    .toLowerCase();
  if (safeDecision === "bat") {
    return "chose to bat";
  }
  if (safeDecision === "bowl") {
    return "chose to bowl";
  }
  return "ready to start";
}

function buildMatchIntroPopup(match, teamA, teamB) {
  const tossWinner = String(match?.tossWinner || "").trim();
  const tossDecision = String(match?.tossDecision || "").trim();
  const totalOvers = Number(match?.overs || 0);
  const teamAPlayers = Array.isArray(teamA?.players) ? teamA.players.length : 0;
  const teamBPlayers = Array.isArray(teamB?.players) ? teamB.players.length : 0;

  if (!tossWinner && !totalOvers && !teamA?.name && !teamB?.name) {
    return null;
  }

  return {
    key: `intro-${match?._id || "match"}-${tossWinner || "setup"}-${tossDecision || "none"}`,
    eyebrow: "Match setup",
    title: tossWinner ? `${tossWinner} won the toss` : "Match created",
    meta: tossWinner
      ? `${buildTossDecisionText(tossDecision)} | ${totalOvers} overs`
      : `${totalOvers} overs scheduled`,
    detail: `${teamA?.name || "Team A"} (${teamAPlayers}) vs ${teamB?.name || "Team B"} (${teamBPlayers})`,
    type: "intro",
  };
}

function getInningsPlayers(match, inningsKey, teamA, teamB) {
  const inningsTeam = String(match?.[inningsKey]?.team || "").trim();
  if (inningsTeam && inningsTeam === teamA?.name) {
    return Array.isArray(teamA?.players) ? teamA.players : [];
  }
  if (inningsTeam && inningsTeam === teamB?.name) {
    return Array.isArray(teamB?.players) ? teamB.players : [];
  }

  return inningsKey === "innings2"
    ? Array.isArray(teamB?.players)
      ? teamB.players
      : []
    : Array.isArray(teamA?.players)
      ? teamA.players
      : [];
}

function buildBattingCardPopup(match, teamA, teamB) {
  const eventType = String(match?.lastLiveEvent?.type || "").trim();
  const hasResult = Boolean(String(match?.result || "").trim());
  const inningsKey =
    eventType === "innings_change"
      ? "innings1"
      : hasResult || eventType === "match_end" || eventType === "target_chased"
        ? Array.isArray(match?.innings2?.history) && match.innings2.history.length
          ? "innings2"
          : "innings1"
        : "";

  if (!inningsKey) {
    return null;
  }

  const innings = match?.[inningsKey];
  if (!innings) {
    return null;
  }

  const players = getInningsPlayers(match, inningsKey, teamA, teamB);
  const tracked = calculateTrackedPlayerStats(innings, players);
  if (!Array.isArray(tracked?.battingStats) || !tracked.battingStats.length) {
    return null;
  }

  const inningsSummary = calculateInningsSummary(innings);
  const teamName = String(innings?.team || "Batting card").trim();
  const displayedRows = tracked.battingStats.slice(0, 11);
  const battingRuns = displayedRows.reduce(
    (total, player) => total + Number(player?.runs || 0),
    0,
  );
  const extras = Math.max(Number(innings?.score || 0) - battingRuns, 0);
  const wickets =
    displayedRows.filter((player) => String(player?.status || "").toLowerCase() === "out")
      .length || Number(match?.outs || 0);
  const scoreText = `${Number(innings?.score || 0)}-${wickets}`;
  const footerText =
    eventType === "innings_change"
      ? `${String(match?.innings2?.team || teamB?.name || "Chasing team").trim()} need ${Number(innings?.score || 0) + 1}`
      : String(match?.result || "Live batting card").trim();

  return {
    key: `batting-card-${match?.lastLiveEvent?.id || match?._id || inningsKey}`,
    type: "batting-card",
    teamName,
    title: teamName,
    subtitle: eventType === "innings_change" ? "Innings complete" : "Batting scorecard",
    rows: displayedRows,
    extras,
    overs: inningsSummary.overs || formatOversFromBalls(innings?.legalBallCount || 0),
    total: scoreText,
    footer: footerText,
  };
}

function resolveEventEffect(event) {
  if (!event || event.type !== "score_update") {
    return null;
  }

  if (event?.ball?.isOut) {
    return {
      key: event.id,
      label: "WICKET",
      accent: "from-[#ff5b70] via-[#ef4444] to-[#ff8a3d]",
      ring: "rgba(255,91,112,0.55)",
      tone: "wicket",
    };
  }

  if (!event?.ball?.extraType && Number(event?.ball?.runs) === 6) {
    return {
      key: event.id,
      label: "SIX",
      accent: "from-[#9b5cff] via-[#6246ea] to-[#1ed7ff]",
      ring: "rgba(98,70,234,0.55)",
      tone: "six",
    };
  }

  if (!event?.ball?.extraType && Number(event?.ball?.runs) === 4) {
    return {
      key: event.id,
      label: "FOUR",
      accent: "from-[#17d1ff] via-[#1291ff] to-[#0e62ea]",
      ring: "rgba(18,145,255,0.55)",
      tone: "four",
    };
  }

  return null;
}

function getWinnerName(match) {
  const resultText = String(match?.result || "").trim();
  if (!resultText || isTiedMatchResult(resultText)) {
    return "";
  }

  const wonByMatch = resultText.match(/^(.+?)\s+won\s+by\s+/i);
  if (wonByMatch?.[1]) {
    return wonByMatch[1].trim();
  }

  if (match?.lastLiveEvent?.type === "target_chased") {
    return String(match?.innings2?.team || match?.teamBName || "").trim();
  }

  return "";
}

function getOverlayMode(match, targetRuns, chaseRunsLeft) {
  const eventType = String(match?.lastLiveEvent?.type || "").trim();
  const resultText = String(match?.result || "").trim();
  const ball = match?.lastLiveEvent?.ball || null;

  if (resultText && isTiedMatchResult(resultText)) {
    return "tie";
  }
  if (eventType === "match_end" || resultText) {
    return "win";
  }
  if (eventType === "innings_change") {
    return "innings";
  }
  if (eventType === "target_chased") {
    return "win";
  }
  if (eventType === "score_update" && ball?.isOut) {
    return "wicket";
  }
  if (
    eventType === "score_update" &&
    !ball?.extraType &&
    Number(ball?.runs || 0) === 6
  ) {
    return "six";
  }
  if (
    eventType === "score_update" &&
    !ball?.extraType &&
    Number(ball?.runs || 0) === 4
  ) {
    return "four";
  }
  if (targetRuns > 0 && chaseRunsLeft <= 12) {
    return "chase";
  }

  return "live";
}

function getModeTheme(mode) {
  const themes = {
    win: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.22)",
    },
    tie: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.22)",
    },
    innings: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.22)",
    },
    wicket: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.24)",
    },
    six: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.24)",
    },
    four: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.24)",
    },
    chase: {
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      panel: "from-[#090909] via-[#18080c] to-[#090909]",
      glow: "rgba(225,29,46,0.22)",
    },
    live: {
      accent: "from-[#f7c948] via-[#ffffff] to-[#e11d2e]",
      panel: "from-[#090909] via-[#111111] to-[#090909]",
      glow: "rgba(247,201,72,0.18)",
    },
  };

  return themes[mode] || themes.live;
}

function getHeroCopy(match, mode, scenarioLabel, scenarioMessage, winnerName) {
  const battingTeam = String(
    match?.innings === "second"
      ? match?.innings2?.team
      : match?.innings1?.team || match?.teamAName || "Team",
  ).trim();

  if (mode === "win") {
    return {
      eyebrow: "Match Complete",
      title: winnerName ? `Congrats ${winnerName}` : "Match Complete",
      message: String(
        match?.result || scenarioMessage || "Result confirmed.",
      ).trim(),
    };
  }

  if (mode === "tie") {
    return {
      eyebrow: "Match Complete",
      title: "Match Tied",
      message: scenarioMessage,
    };
  }

  if (mode === "innings") {
    return {
      eyebrow: "Innings Complete",
      title: `${battingTeam} ${Number(match?.innings1?.score || match?.score || 0)}`,
      message: scenarioMessage,
    };
  }

  if (mode === "wicket") {
    return {
      title: "Wicket",
      message: `${Number(match?.score || 0)}/${Number(match?.outs || 0)} after ${formatOversFromBalls(match?.legalBallCount)} overs.`,
    };
  }

  if (mode === "six" || mode === "four") {
    return {
      eyebrow: "Boundary",
      title: mode === "six" ? "Six" : "Four",
      message: scenarioMessage,
    };
  }

  if (mode === "chase") {
    return {
      eyebrow: "Pressure Chase",
      title: scenarioLabel,
      message: scenarioMessage,
    };
  }

  return {
    eyebrow: scenarioLabel,
    title: "Live Match",
    message: scenarioMessage,
  };
}

function getBallChipClasses(type) {
  const classes = {
    wicket:
      "border-[#ff6b77]/60 bg-[linear-gradient(180deg,#d7264f,#8a1029)] text-white shadow-[0_0_14px_rgba(255,91,112,0.24)]",
    six: "border-[#8d78ff]/60 bg-[linear-gradient(180deg,#7657ff,#4a28cf)] text-white shadow-[0_0_14px_rgba(123,97,255,0.24)]",
    four: "border-[#3cb7ff]/60 bg-[linear-gradient(180deg,#1597ff,#0d65c7)] text-white shadow-[0_0_14px_rgba(21,151,255,0.24)]",
    extra:
      "border-[#3ad97f]/60 bg-[linear-gradient(180deg,#19b766,#0d7c45)] text-white shadow-[0_0_14px_rgba(25,183,102,0.22)]",
    run: "border-white/20 bg-[linear-gradient(180deg,#7d8794,#3c4654)] text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]",
    dot: "border-white/16 bg-[linear-gradient(180deg,#485364,#202833)] text-white/92 shadow-[0_0_10px_rgba(255,255,255,0.08)]",
  };

  return classes[type] || classes.run;
}

function getMomentPopupClasses(type) {
  const classes = {
    result: {
      shell:
        "border-[#f7c948]/35 bg-[linear-gradient(135deg,#14090a,#090909_50%,#1a0d10)] shadow-[0_22px_54px_rgba(225,29,46,0.24)]",
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      title: "text-[#fff7d1]",
    },
    innings: {
      shell:
        "border-[#e11d2e]/30 bg-[linear-gradient(135deg,#11070a,#090909_54%,#18090c)] shadow-[0_22px_54px_rgba(225,29,46,0.22)]",
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      title: "text-white",
    },
    over: {
      shell:
        "border-[#e11d2e]/20 bg-[linear-gradient(135deg,#0d0a0a,#090909_52%,#14080b)] shadow-[0_18px_42px_rgba(0,0,0,0.5)]",
      accent: "from-[#7d0b13] via-[#e11d2e] to-[#f7c948]",
      title: "text-white",
    },
    intro: {
      shell:
        "border-[#f7c948]/20 bg-[linear-gradient(135deg,#151107,#090909_54%,#14090a)] shadow-[0_18px_42px_rgba(0,0,0,0.52)]",
      accent: "from-[#f7c948] via-[#ffffff] to-[#e11d2e]",
      title: "text-white",
    },
  };

  return classes[type] || classes.over;
}

export default function SessionOverlayClient({ sessionId, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [streamError, setStreamError] = useState("");
  const [activeEventEffect, setActiveEventEffect] = useState(null);
  const [activeMomentPopup, setActiveMomentPopup] = useState(null);
  const lastSignatureRef = useRef(buildOverlaySignature(initialData));
  const lastAnnouncedEventRef = useRef("");
  const lastIntroPopupRef = useRef("");
  const shouldReduceMotion = useReducedMotion();

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    disconnectWhenHidden: false,
    onMessage: (payload) => {
      applySessionStreamPayload({
        payload,
        lastSignatureRef,
        setData,
        setStreamError,
        getSignature: buildOverlaySignature,
      });
    },
    onError: () => {
      if (!data) {
        setStreamError("Could not load the live overlay.");
      }
    },
  });

  const session = data?.session || null;
  const match = data?.match || null;
  const teamA = useMemo(
    () => getTeamBundle(match || session || {}, "teamA"),
    [match, session],
  );
  const teamB = useMemo(
    () => getTeamBundle(match || session || {}, "teamB"),
    [match, session],
  );
  const battingTeam = useMemo(() => getBattingTeamBundle(match || {}), [match]);
  const bowlingTeamName =
    battingTeam.name === teamA.name ? teamB.name : teamA.name;
  const inningsSummary = useMemo(
    () => buildInningsSummary(match, teamA, teamB),
    [match, teamA, teamB],
  );
  const currentStriker = useMemo(() => getCurrentStriker(match), [match]);
  const currentBowler = useMemo(() => getCurrentOverBowler(match), [match]);
  const currentOverSummary = useMemo(
    () => getCurrentOverSummary(match),
    [match],
  );
  const recentOversDisplay = useMemo(
    () => getRecentOversDisplay(match),
    [match],
  );
  const eventEffect = useMemo(
    () => resolveEventEffect(match?.lastLiveEvent || null),
    [match?.lastLiveEvent],
  );
  const speech = useSpeechAnnouncer({
    enabled: Boolean(match?.announcerEnabled !== false),
    muted: false,
    mode: match?.announcerMode || "full",
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      speech.prime({ userGesture: true });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [speech]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!eventEffect) {
      return undefined;
    }

    const showTimer = window.setTimeout(() => {
      setActiveEventEffect(eventEffect);
    }, 0);
    const hideTimer = window.setTimeout(() => {
      setActiveEventEffect((current) => {
        return current?.key === eventEffect.key ? null : current;
      });
    }, 5000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [eventEffect]);

  useEffect(() => {
    if (typeof window === "undefined" || !match?.lastLiveEvent?.id) {
      return undefined;
    }

    const liveScore = Number(match.score || 0);
    const liveTargetRuns =
      match.innings === "second" ? Number(match?.innings1?.score || 0) + 1 : 0;
    const liveChaseRunsLeft =
      liveTargetRuns > 0 ? Math.max(liveTargetRuns - liveScore, 0) : 0;
    const liveBallsLeft = countInningsBallsLeft(match);
    const liveTeamA = getTeamBundle(match || {}, "teamA");
    const liveTeamB = getTeamBundle(match || {}, "teamB");
    const popup =
      buildBattingCardPopup(match, liveTeamA, liveTeamB) ||
      buildResultPopup(match, getWinnerName(match)) ||
      buildInningsPopup(match) ||
      buildOverPopup(match, liveTargetRuns, liveChaseRunsLeft, liveBallsLeft);
    if (!popup) {
      return undefined;
    }

    const showTimer = window.setTimeout(() => {
      setActiveMomentPopup(popup);
    }, 0);
    const hideTimer = window.setTimeout(() => {
      setActiveMomentPopup((current) => {
        return current?.key === popup.key ? null : current;
      });
    }, 8000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [match, match?.lastLiveEvent?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !match?._id) {
      return undefined;
    }

    if (
      match?.lastLiveEvent?.id ||
      match?.legalBallCount > 0 ||
      match?.result
    ) {
      return undefined;
    }

    const introPopup = buildMatchIntroPopup(match, teamA, teamB);
    if (!introPopup || lastIntroPopupRef.current === introPopup.key) {
      return undefined;
    }

    lastIntroPopupRef.current = introPopup.key;
    const showTimer = window.setTimeout(() => {
      setActiveMomentPopup(introPopup);
    }, 120);
    const hideTimer = window.setTimeout(() => {
      setActiveMomentPopup((current) => {
        return current?.key === introPopup.key ? null : current;
      });
    }, 8000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [match, teamA, teamB]);

  useEffect(() => {
    if (!match?.lastLiveEvent?.id || !match?._id) {
      return;
    }

    if (lastAnnouncedEventRef.current === match.lastLiveEvent.id) {
      return;
    }

    lastAnnouncedEventRef.current = match.lastLiveEvent.id;
    const sequence = buildLiveScoreAnnouncementSequence(
      match.lastLiveEvent,
      match,
      match?.announcerMode || "full",
    );

    if (sequence?.items?.length) {
      speech.speakSequence(sequence.items, {
        key: `overlay-${match._id}-${match.lastLiveEvent.id}`,
        priority: Number(sequence.priority || 2),
        interrupt: true,
        minGapMs: 0,
      });
    }
  }, [
    match,
    match?._id,
    match?.announcerMode,
    match?.lastLiveEvent,
    match?.lastLiveEvent?.id,
    speech,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const prime = () => {
      speech.prime({ userGesture: true });
    };

    window.addEventListener("pointerup", prime, { once: true });
    window.addEventListener("click", prime, { once: true });
    window.addEventListener("touchend", prime, { once: true });

    return () => {
      window.removeEventListener("pointerup", prime);
      window.removeEventListener("click", prime);
      window.removeEventListener("touchend", prime);
    };
  }, [speech]);

  if (streamError && !data) {
    return (
      <main className="flex min-h-screen items-end justify-center bg-transparent p-6 text-white">
        <div className="w-full max-w-6xl rounded-[24px] border border-[#ff5b70]/25 bg-black/75 px-6 py-4 text-sm font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
          {streamError}
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  if (!match) {
    return (
      <main className="flex min-h-screen items-end justify-center bg-transparent p-6 text-white">
        <div className="w-full max-w-5xl rounded-[18px] border border-white/10 bg-black/60 px-5 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md">
          <p className="text-lg font-black tracking-tight text-white">
            Waiting for the next match to start
          </p>
        </div>
      </main>
    );
  }

  const score = Number(match.score || 0);
  const wickets = Number(match.outs || 0);
  const oversText = formatOversFromBalls(match.legalBallCount);
  const targetRuns =
    match.innings === "second" ? Number(match?.innings1?.score || 0) + 1 : 0;
  const chaseRunsLeft = targetRuns > 0 ? Math.max(targetRuns - score, 0) : 0;
  const inningsBallsLeft = countInningsBallsLeft(match);
  const battingShort = shortenTeamName(battingTeam.name);
  const ballsLeftInOver = countBallsLeftInOver(match);
  const overlayMode = getOverlayMode(match, targetRuns, chaseRunsLeft);
  const modeTheme = getModeTheme(overlayMode);
  const winnerName = getWinnerName(match);
  const scoreKey = `${match?._id || "match"}-${score}-${wickets}-${oversText}-${overlayMode}`;
  const glowKey = `${match?.lastLiveEvent?.id || scoreKey}-glow`;
  const strikerLabel = compactLabel(currentStriker || "", 18);
  const bowlerLabel = compactLabel(currentBowler || "", 18);
  const currentOverTotals = calculateOverTotals(match);
  const currentOverLabel =
    Number(match?.activeOverNumber || 0) ||
    Math.floor(Number(match?.legalBallCount || 0) / 6) + 1;
  const totalOvers = Number(match?.overs || 0);
  const totalPlayers = Math.max(
    Array.isArray(teamA?.players) ? teamA.players.length : 0,
    Array.isArray(teamB?.players) ? teamB.players.length : 0,
  );
  const targetLabelText =
    targetRuns > 0 ? `Target ${targetRuns}` : `${totalOvers} overs total`;
  const centerMetaText = `${totalPlayers} players`;
  const chaseLineText =
    targetRuns > 0
      ? `Runs ${chaseRunsLeft} | Balls ${inningsBallsLeft}`
      : `${totalOvers} overs match`;
  const visibleMomentPopup =
    activeMomentPopup?.type === "over" &&
    match?.lastLiveEvent?.type === "score_update" &&
    !match?.lastLiveEvent?.overCompleted
      ? null
      : activeMomentPopup;
  const momentClasses = visibleMomentPopup
    ? getMomentPopupClasses(visibleMomentPopup.type)
    : getMomentPopupClasses("over");
  const popupFrameClass =
    visibleMomentPopup?.type === "batting-card"
      ? "min-w-[1080px] max-w-[92vw] rounded-[20px] px-0 py-0"
      : visibleMomentPopup?.type === "over"
      ? "min-w-[760px] max-w-[88vw] rounded-[16px] px-10 py-6 md:min-w-[980px] md:px-14 md:py-7"
      : "min-w-[520px] max-w-[78vw] rounded-[26px] px-8 py-5";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(2,5,10,0.5)_46%,rgba(2,5,10,0.92)_100%)]" />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r ${modeTheme.accent}`}
      />
      <section className="pointer-events-none absolute left-5 top-5 z-20">
        <div className="relative h-16 w-16 drop-shadow-[0_0_24px_rgba(225,29,46,0.36)] md:h-20 md:w-20 xl:h-24 xl:w-24">
          <Image
            src="/gvLogo.png"
            alt="GV Cricket"
            fill
            sizes="96px"
            className="scale-[2.5] object-contain"
            priority
          />
        </div>
      </section>

      <AnimatePresence mode="wait">
        {activeEventEffect ? (
          <motion.section
            key={activeEventEffect.key}
            className={`pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6 overlay-event-stage overlay-event-stage-${activeEventEffect.tone}`}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.span
              className={`absolute inset-x-0 top-[45%] h-28 bg-gradient-to-r ${activeEventEffect.accent} opacity-20 blur-3xl`}
              initial={
                shouldReduceMotion ? false : { scaleX: 0.35, opacity: 0 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 0.18 }
                  : { scaleX: [0.35, 1, 0.78], opacity: [0, 0.28, 0.08] }
              }
              transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.span
              className="overlay-speed-line overlay-speed-line-one"
              initial={shouldReduceMotion ? false : { x: "-120%", opacity: 0 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0.25 }
                  : { x: "120%", opacity: [0, 0.45, 0] }
              }
              transition={{
                duration: activeEventEffect.tone === "wicket" ? 0.9 : 1.3,
                ease: "easeOut",
              }}
            />
            <motion.span
              className="overlay-speed-line overlay-speed-line-two"
              initial={shouldReduceMotion ? false : { x: "120%", opacity: 0 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0.16 }
                  : { x: "-120%", opacity: [0, 0.28, 0] }
              }
              transition={{
                duration: activeEventEffect.tone === "six" ? 1.45 : 1.05,
                ease: "easeOut",
                delay: 0.08,
              }}
            />
            <motion.p
              className="pointer-events-none absolute inset-x-0 top-[35%] text-center text-[4.5rem] font-black uppercase tracking-[0.4em] text-white/[0.08] md:text-[7rem] xl:text-[11rem]"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: [0, 0.2, 0.08], scale: [0.92, 1.04, 1] }
              }
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeEventEffect.label}
            </motion.p>
            <motion.div
              className={`overlay-event-burst overlay-event-burst-${activeEventEffect.tone} bg-gradient-to-r ${activeEventEffect.accent} shadow-[0_0_46px_var(--overlay-ring)]`}
              style={{ "--overlay-ring": activeEventEffect.ring }}
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      y: 18,
                      scale: activeEventEffect.tone === "six" ? 0.72 : 0.84,
                      rotate: activeEventEffect.tone === "wicket" ? -1.5 : 0,
                    }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: 0,
                      scale:
                        activeEventEffect.tone === "six"
                          ? [0.72, 1.16, 1]
                          : [0.84, 1.05, 1],
                      rotate:
                        activeEventEffect.tone === "wicket"
                          ? [-1.5, 1.5, -0.5, 0]
                          : 0,
                      boxShadow: [
                        "0 0 24px var(--overlay-ring)",
                        "0 0 58px var(--overlay-ring)",
                        "0 0 24px var(--overlay-ring)",
                      ],
                    }
              }
              transition={{ duration: 1.15, ease: [0.18, 1.25, 0.4, 1] }}
            >
              <div className="absolute inset-y-0 left-0 w-10 bg-white/14 blur-xl" />
              <span className="overlay-event-shine" />
              <p className="relative z-10 text-3xl font-black uppercase tracking-[0.2em] text-white md:text-5xl xl:text-7xl">
                {activeEventEffect.label}
              </p>
            </motion.div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {visibleMomentPopup ? (
          <motion.section
            key={visibleMomentPopup.key}
            className="pointer-events-none absolute inset-x-0 top-[20%] z-40 flex justify-center px-6"
            initial={
              shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, scale: 0.98 }
            }
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`relative overflow-hidden border text-center ${popupFrameClass} ${momentClasses.shell}`}
            >
              {visibleMomentPopup.type === "batting-card" ? (
                <div className="relative z-10 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#130708,#26090d)] text-left shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
                  <div className="bg-[linear-gradient(90deg,#570d12,#a5121e,#570d12)] px-8 py-5 md:px-10">
                    <div className="flex items-center gap-5">
                      <div className="relative h-16 w-16 shrink-0 rounded-full border border-white/20 bg-black/20 shadow-[0_0_22px_rgba(239,68,68,0.25)] md:h-20 md:w-20">
                        <Image
                          src="/gvLogo.png"
                          alt="GV Cricket"
                          fill
                          sizes="80px"
                          className="scale-[1.12] object-contain p-2"
                          priority
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="rounded-[18px] border border-white/16 bg-black/30 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          <p className="truncate text-[2rem] font-black uppercase leading-none text-white md:text-[3rem]">
                            {visibleMomentPopup.teamName}
                          </p>
                        </div>
                        <p className="mt-3 text-[0.92rem] font-black uppercase tracking-[0.16em] text-white/78 md:text-[1.05rem]">
                          {visibleMomentPopup.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1.6fr_1fr_110px_110px] border-y border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-8 py-2 text-[0.8rem] font-black uppercase tracking-[0.14em] text-white/84 md:px-10 md:text-[0.95rem]">
                    <span>Batter</span>
                    <span>Status</span>
                    <span className="text-center">Runs</span>
                    <span className="text-center">Balls</span>
                  </div>
                  <div className="bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(255,255,255,0.02))] px-8 py-2 md:px-10">
                    {visibleMomentPopup.rows.map((player, index) => {
                      const isNotOut = String(player?.status || "").toLowerCase() === "not out";
                      return (
                        <div
                          key={`batting-card-row-${player.name}-${index}`}
                          className={`grid grid-cols-[1.6fr_1fr_110px_110px] items-center border-b border-white/8 px-2 py-2.5 text-[0.95rem] md:text-[1.15rem] ${
                            isNotOut
                              ? "bg-[linear-gradient(90deg,rgba(185,28,28,0.55),rgba(127,29,29,0.38))]"
                              : "bg-transparent"
                          }`}
                        >
                          <span className="truncate font-black uppercase text-white">
                            {player.name}
                          </span>
                          <span className="truncate uppercase text-white/80">
                            {player.status}
                          </span>
                          <span className="text-center font-black text-white">
                            {player.runs}
                          </span>
                          <span className="text-center text-white/86">
                            {player.balls}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[150px_1fr_190px_220px] items-center border-t border-white/12 bg-[linear-gradient(180deg,#e5e7eb,#a1a1aa)] px-8 py-3 text-black md:px-10">
                    <div className="flex items-center gap-3">
                      <span className="text-[1rem] font-black uppercase">Extras</span>
                      <span className="text-[1.1rem] font-black">{visibleMomentPopup.extras}</span>
                    </div>
                    <div className="text-center text-[1rem] font-black uppercase">
                      Overs {visibleMomentPopup.overs}
                    </div>
                    <div className="text-center text-[1rem] font-black uppercase">
                      Total
                    </div>
                    <div className="text-right text-[2rem] font-black uppercase">
                      {visibleMomentPopup.total}
                    </div>
                  </div>
                  <div className="border-t border-white/8 bg-black/28 px-8 py-3 text-center text-[0.9rem] font-black uppercase tracking-[0.12em] text-white/84 md:px-10">
                    {visibleMomentPopup.footer}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${momentClasses.accent}`}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--mode-glow),transparent_58%)]" />
                  <span className="overlay-popup-scan" />
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#f7c948]">
                      {visibleMomentPopup.eyebrow}
                    </p>
                    <p
                      className={`mt-1 text-[3rem] font-black uppercase leading-none md:text-[3.8rem] ${momentClasses.title}`}
                    >
                      {visibleMomentPopup.title}
                    </p>
                    <p className="mt-2 text-[1.05rem] font-black uppercase text-white md:text-[1.18rem]">
                      {visibleMomentPopup.meta}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-4 text-[0.82rem] font-black uppercase tracking-[0.14em] text-white/76 md:text-[0.92rem]">
                      {visibleMomentPopup.summaryLeft ? (
                        <span>{visibleMomentPopup.summaryLeft}</span>
                      ) : null}
                      {visibleMomentPopup.summaryLeft &&
                      visibleMomentPopup.summaryRight ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#f7c948]" />
                      ) : null}
                      {visibleMomentPopup.summaryRight ? (
                        <span>{visibleMomentPopup.summaryRight}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[0.82rem] font-bold uppercase tracking-[0.14em] text-white/78 md:text-[0.92rem]">
                      {visibleMomentPopup.detail}
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
        <div className="mx-auto w-full max-w-[1920px] px-0">
          <motion.div
            className={`relative overflow-hidden border-t border-white/20 bg-[#070c14] bg-gradient-to-r ${modeTheme.panel} shadow-[0_-18px_42px_rgba(0,0,0,0.62)]`}
            style={{ "--mode-glow": modeTheme.glow }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 34 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`h-[3px] w-full bg-gradient-to-r ${modeTheme.accent}`}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-40%,var(--mode-glow),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.12))]" />
            <motion.div
              key={glowKey}
              className="pointer-events-none absolute inset-x-[24%] top-0 hidden h-[3px] rounded-b-full bg-white/80 blur-[1px] lg:block"
              initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0.4 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: [0.15, 0.95, 0.28], scaleX: [0.55, 1, 0.75] }
              }
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            <div className="grid min-h-[68px] items-stretch gap-0 sm:grid-cols-[0.9fr_0.78fr_1.2fr] md:min-h-[78px] xl:min-h-[88px] xl:grid-cols-[0.94fr_0.96fr_1fr]">
              <div className="flex min-w-0 items-center border-r border-white/10 px-3 py-1.5 md:px-6 xl:px-12">
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#f7c948] md:text-[9px] xl:text-[10px]">
                      Batting
                    </p>
                    <motion.p
                      key={battingShort}
                      className="break-words text-[1.1rem] font-black uppercase leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] md:text-[1.55rem] xl:text-[1.95rem]"
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, x: -10 }
                      }
                      animate={
                        shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }
                      }
                      transition={{ duration: 0.22 }}
                    >
                      {battingShort}
                    </motion.p>
                    {(strikerLabel || bowlerLabel) ? (
                      <div className="flex min-w-0 flex-col gap-1 text-[0.58rem] font-black uppercase tracking-[0.06em] text-white/90 md:text-[0.72rem] xl:text-[0.84rem]">
                        {strikerLabel ? (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 text-[#f7c948]">Striker</span>
                            <span className="truncate text-white">{strikerLabel}</span>
                          </div>
                        ) : null}
                        {bowlerLabel ? (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 text-[#f7c948]">Bowler</span>
                            <span className="truncate text-white">{bowlerLabel}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-1 text-[0.52rem] font-black uppercase tracking-[0.08em] text-white/68 md:text-[0.62rem] xl:text-[0.72rem]">
                      <span>
                        {match?.innings === "second" ? "Chasing" : "Batting first"}
                      </span>
                      <span>
                        {targetRuns > 0
                          ? `${chaseRunsLeft} to win`
                          : `${totalOvers} overs total`}
                      </span>
                      {match?.tossWinner ? (
                        <span className="truncate">
                          {`${compactLabel(match.tossWinner, 12)} ${buildTossDecisionText(match?.tossDecision)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative mt-1 h-14 w-14 shrink-0 drop-shadow-[0_0_24px_rgba(225,29,46,0.36)] md:h-[70px] md:w-[70px] xl:h-[86px] xl:w-[86px]">
                    <Image
                      src="/gvLogo.png"
                      alt="GV Cricket"
                      fill
                      sizes="86px"
                      className="scale-[2] object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>

              <div className="relative flex min-w-0 items-center justify-center overflow-hidden border-r border-white/10 px-2 py-1 text-center md:px-4">
                <div
                  className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r ${modeTheme.accent} opacity-70`}
                />
                <div className="relative z-10 w-full">
                  <motion.p
                    key={scoreKey}
                    className="text-[1.8rem] font-black leading-none text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.72)] md:text-[2.65rem] xl:text-[3.65rem]"
                    initial={
                      shouldReduceMotion
                        ? false
                        : { scale: 0.88, opacity: 0.7, y: 7 }
                    }
                    animate={
                      shouldReduceMotion
                        ? { opacity: 1 }
                        : { scale: 1, opacity: 1, y: 0 }
                    }
                    transition={{ duration: 0.28, ease: [0.18, 1.25, 0.4, 1] }}
                  >
                    <span>{score}</span>
                    <span className="text-white/80">/</span>
                    <span>{wickets}</span>
                  </motion.p>
                  <div className="mt-1 flex items-center justify-center gap-2 text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/78 md:text-[0.62rem] xl:text-[0.74rem]">
                    <span className="text-[#f7c948]">Overs</span>
                    <span className="text-white">{oversText}</span>
                    <span className="text-[#f7c948]">|</span>
                    <span>{centerMetaText}</span>
                    <span className="text-[#f7c948]">|</span>
                    <span>{targetLabelText}</span>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 items-center px-3 py-1.5 md:px-5 xl:px-12">
                <div className="w-full">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-black uppercase tracking-[0.18em] text-[#f7c948] md:text-[9px] xl:text-[10px]">
                        Over
                      </span>
                      <span className="text-[0.74rem] font-black uppercase text-white md:text-[0.9rem] xl:text-[1rem]">
                        {currentOverLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[0.58rem] font-black uppercase text-white/90 md:text-[0.7rem] xl:gap-2 xl:text-[0.82rem]">
                      <span>{currentOverTotals.runs} runs</span>
                      <span className="h-1 w-1 rounded-full bg-[#f7c948]" />
                      <span>{currentOverTotals.wickets} wkts</span>
                      <span className="h-1 w-1 rounded-full bg-[#f7c948]" />
                      <span>{ballsLeftInOver} left</span>
                    </div>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.5rem] font-black uppercase tracking-[0.08em] text-white/68 md:text-[0.62rem] xl:text-[0.72rem]">
                    <span className="min-w-0 flex-1 truncate">{chaseLineText}</span>
                    <span className="shrink-0 text-right">
                      {match?.innings === "second"
                        ? "Second innings"
                        : "First innings"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex min-w-0 items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      {recentOversDisplay.length ? (
                        recentOversDisplay.map((over, overIndex) => (
                          <div
                            key={`recent-over-${over.overNumber}-${overIndex}`}
                            className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[0.52rem] font-black uppercase tracking-[0.18em] text-[#f7c948] md:text-[0.62rem] xl:text-[0.72rem]">
                                Over {over.overNumber}
                              </span>
                              <span className="text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/72 md:text-[0.62rem] xl:text-[0.72rem]">
                                {over.runs} runs
                              </span>
                              {over.wickets > 0 ? (
                                <span className="text-[0.52rem] font-black uppercase tracking-[0.1em] text-white/72 md:text-[0.62rem] xl:text-[0.72rem]">
                                  {over.wickets} wkts
                                </span>
                              ) : null}
                            </div>
                            <div className="flex min-h-[26px] min-w-0 flex-wrap items-start justify-end gap-1.5 md:min-h-[30px] md:gap-2">
                              {over.values.map((value, valueIndex) => (
                                <div
                                  key={`recent-over-ball-${over.overNumber}-${valueIndex}`}
                                  className="text-center"
                                >
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,#40444d,#252933)] text-[0.6rem] font-black text-white md:h-8 md:w-8 md:text-[0.68rem]">
                                    {value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : currentOverSummary.length ? (
                        <div className="flex min-h-[38px] min-w-0 flex-wrap items-start justify-start gap-1.5 md:min-h-[46px] md:gap-2 xl:min-h-[54px] xl:gap-3">
                          {currentOverSummary.map((ball, index) => (
                            <motion.div
                              key={`${ball.top}-${ball.bottom}-${index}`}
                              className="text-center"
                              initial={
                                shouldReduceMotion
                                  ? false
                                  : { opacity: 0, y: 10, scale: 0.82 }
                              }
                              animate={
                                shouldReduceMotion
                                  ? { opacity: 1 }
                                  : { opacity: 1, y: 0, scale: 1 }
                              }
                              transition={{
                                duration: 0.24,
                                delay: shouldReduceMotion ? 0 : index * 0.04,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[0.72rem] font-black md:h-10 md:w-10 md:text-[0.9rem] xl:h-12 xl:w-12 xl:text-[1rem] ${getBallChipClasses(ball.type)}`}
                              >
                                {ball.top}
                              </div>
                              <p className="mt-1 text-[7px] font-black leading-none text-white md:text-[9px] xl:text-[10px]">
                                {ball.bottom}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-1 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/80">
                          Waiting for first ball
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <style jsx>{`
        .overlay-event-burst {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 24px;
          padding: 1rem 1.9rem;
          backdrop-filter: blur(10px);
        }

        .overlay-event-stage {
          background: radial-gradient(
            circle at 50% 46%,
            rgba(255, 255, 255, 0.12),
            rgba(0, 0, 0, 0.02) 32%,
            transparent 58%
          );
        }

        .overlay-event-stage-wicket {
          animation: overlay-impact-shake 520ms ease-out 80ms both;
        }

        .overlay-event-burst-four {
          border-radius: 18px;
        }

        .overlay-event-burst-six {
          border-radius: 999px;
          padding-inline: 2.4rem;
        }

        .overlay-event-burst-wicket {
          border-radius: 20px;
        }

        .overlay-event-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.08) 24%,
            rgba(255, 255, 255, 0.36) 46%,
            rgba(255, 255, 255, 0.06) 58%,
            transparent 100%
          );
          transform: translateX(-120%);
          animation: overlay-shine 1700ms ease-out 220ms forwards;
        }

        .overlay-speed-line {
          position: absolute;
          left: -10%;
          right: -10%;
          height: 2px;
          transform: rotate(-7deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.8),
            transparent
          );
          filter: blur(0.4px);
        }

        .overlay-speed-line-one {
          top: 40%;
        }

        .overlay-speed-line-two {
          top: 57%;
          transform: rotate(6deg);
        }

        .overlay-popup-scan {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 42%,
            rgba(255, 255, 255, 0.22) 50%,
            rgba(255, 255, 255, 0.08) 58%,
            transparent 100%
          );
          transform: translateX(-120%);
          animation: overlay-shine 1900ms ease-out 120ms forwards;
        }

        @keyframes overlay-shine {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }

        @keyframes overlay-impact-shake {
          0% {
            transform: translateX(0);
          }
          18% {
            transform: translateX(-7px);
          }
          36% {
            transform: translateX(6px);
          }
          54% {
            transform: translateX(-4px);
          }
          72% {
            transform: translateX(2px);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </main>
  );
}
