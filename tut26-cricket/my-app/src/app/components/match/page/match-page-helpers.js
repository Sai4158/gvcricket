/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: createSoundEffectRequestId, createScoreActionId, getMatchEndStageState, estimateSpeechLeadDelayMs, estimateBoundaryLeadDelayMs, estimateSpeechSequenceDelayMs, getConfiguredScoreEffectDelayMs, buildFallbackSoundEffectFromId, getSelectedScoreSoundEffectIds, readCachedSoundEffectDurations, writeCachedSoundEffectDurations, IPL_HORN_EFFECT, SCORE_PRE_EFFECT_RATE, SCORE_PRE_EFFECT_GAP_MS, WIDE_PLUS_ONE_EXTRA_DELAY_MS, ENTRY_SCORE_SOUND_EFFECTS_MODAL, STAGE_CARD_REVEAL_TIMEOUT_MS.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ./README.md
 */

import {
  getScoreSoundEffectEventKey,
  normalizeScoreSoundEffectMap,
  RANDOM_SCORE_EFFECT_ID,
} from "../../../lib/score-sound-effects";
import { countLegalBalls } from "../../../lib/match-scoring";
import { getTotalDismissalsAllowed } from "../../../lib/team-utils";

export const IPL_HORN_EFFECT = {
  id: "ipl_theme_song.mp3",
  fileName: "ipl_theme_song.mp3",
  label: "ipl theme song",
  src: "/audio/effects/ipl_theme_song.mp3",
};

export const SCORE_PRE_EFFECT_RATE = 0.8;
export const SCORE_PRE_EFFECT_GAP_MS = 1000;
export const WIDE_PLUS_ONE_EXTRA_DELAY_MS = 1000;
export const ENTRY_SCORE_SOUND_EFFECTS_MODAL = "entryScoreSoundEffects";
export const STAGE_CARD_REVEAL_TIMEOUT_MS = 10000;

const SOUND_EFFECT_DURATION_CACHE_KEY = "gv-sound-effect-durations-v1";

export function createSoundEffectRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `sound-effect:${crypto.randomUUID()}`;
  }

  return `sound-effect:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function createScoreActionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `score:${crypto.randomUUID()}`;
  }

  return `score:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function getMatchEndStageState(match, fallbackMatchId = "") {
  if (!match) {
    return {
      firstInningsComplete: false,
      matchFinished: false,
      showInningsEnd: false,
      key: "",
    };
  }

  const firstInningsHistory = match?.innings1?.history ?? [];
  const firstInningsLegalBalls = countLegalBalls(firstInningsHistory);
  const firstInningsOversDone =
    match?.innings === "first" &&
    firstInningsLegalBalls >= Number(match?.overs || 0) * 6;
  const maxWickets = getTotalDismissalsAllowed(match);
  const firstInningsAllOut =
    match?.innings === "first" &&
    maxWickets > 0 &&
    Number(match?.outs || 0) >= maxWickets;
  const firstInningsComplete = Boolean(
    match?.innings === "first" && (firstInningsOversDone || firstInningsAllOut),
  );
  const displayResult = String(match?.pendingResult || match?.result || "").trim();
  const matchFinished = Boolean(displayResult) || Boolean(
    match?.innings === "second" && !match?.isOngoing,
  );

  let key = "";
  if (matchFinished) {
    key = `result:${match?._id || fallbackMatchId}:${
      displayResult ||
      `${Number(match?.score || 0)}:${Number(match?.outs || 0)}`
    }`;
  } else if (firstInningsComplete) {
    key = `innings:${match?._id || fallbackMatchId}:${
      Number(match?.innings1?.score ?? match?.score ?? 0)
    }:${Number(match?.innings1?.outs ?? match?.outs ?? 0)}`;
  }

  return {
    firstInningsComplete,
    matchFinished,
    showInningsEnd: firstInningsComplete || matchFinished,
    key,
  };
}

export function estimateSpeechLeadDelayMs(text, rate = 1) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const safeRate = Math.max(0.7, Number(rate) || 1);
  const estimatedMs = Math.round((Math.max(words, 1) / (180 * safeRate)) * 60000 + 250);
  return Math.max(1600, Math.min(2600, estimatedMs));
}

export function estimateBoundaryLeadDelayMs(text, rate = 1) {
  return estimateSpeechLeadDelayMs(text, rate) + SCORE_PRE_EFFECT_GAP_MS;
}

export function estimateSpeechSequenceDelayMs(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const estimatedMs = safeItems.reduce((total, item) => {
    const text = String(item?.text || "").trim();
    const rate = Number(item?.rate || 0.82) || 0.82;
    return total + estimateSpeechLeadDelayMs(text, rate) + Math.max(0, Number(item?.pauseAfterMs || 0));
  }, 0);
  return Math.max(1200, Math.min(7000, estimatedMs || 1200));
}

export function getConfiguredScoreEffectDelayMs(
  runs,
  isOut = false,
  extraType = null,
  leadText = "",
  leadRate = SCORE_PRE_EFFECT_RATE,
) {
  const baseDelayMs = leadText
    ? estimateBoundaryLeadDelayMs(leadText, leadRate)
    : 0;
  const effectKey = getScoreSoundEffectEventKey(runs, isOut, extraType);
  if (effectKey === "wide_plus_one") {
    return baseDelayMs + WIDE_PLUS_ONE_EXTRA_DELAY_MS;
  }

  return baseDelayMs;
}

export function buildFallbackSoundEffectFromId(effectId = "") {
  const safeId = String(effectId || "").trim();
  if (!safeId) {
    return null;
  }

  const normalizedFileName = safeId.split("/").pop() || safeId;
  const label = normalizedFileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: safeId,
    fileName: normalizedFileName,
    label: label || normalizedFileName,
    src: `/audio/effects/${encodeURIComponent(normalizedFileName)}`,
  };
}

export function getSelectedScoreSoundEffectIds(scoreSoundEffectMap = {}) {
  const seen = new Set();

  return Object.values(normalizeScoreSoundEffectMap(scoreSoundEffectMap || {}))
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (
        !value ||
        value === RANDOM_SCORE_EFFECT_ID ||
        seen.has(value)
      ) {
        return false;
      }

      seen.add(value);
      return true;
    });
}

export function readCachedSoundEffectDurations() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(SOUND_EFFECT_DURATION_CACHE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeCachedSoundEffectDurations(nextDurations) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SOUND_EFFECT_DURATION_CACHE_KEY,
      JSON.stringify(nextDurations),
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}


