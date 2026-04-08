/**
 * File overview:
 * Purpose: Shared stream-signature and announcer timing helpers for spectator session view.
 * Main exports: stream-signature helpers, score-effect helpers, and overs-left formatting.
 * Major callers: SessionViewClient.
 * Side effects: none.
 * Read next: ./SessionViewIcons.jsx
 */

import { buildSpectatorBallAnnouncement } from "../../lib/live-announcements";
import { getScoreSoundEffectEventKey, RANDOM_SCORE_EFFECT_ID } from "../../lib/score-sound-effects";

export const ANNOUNCER_GESTURE_READ_DELAY_MS = 2000;
export const SIX_PRE_EFFECT_DELAY_MS = 1000;
export const SCORE_EFFECT_FALLBACK_BUFFER_MS = 180;

export function getSessionStreamPayloadSignature(payload) {
  const session = payload?.session || null;
  const match = payload?.match || null;
  const liveEvent = match?.lastLiveEvent || null;

  return JSON.stringify([
    payload?.updatedAt || "",
    session?._id || "",
    session?.updatedAt || "",
    match?._id || "",
    match?.updatedAt || "",
    match?.innings || "",
    match?.score ?? "",
    match?.outs ?? "",
    match?.result || "",
    match?.lastEventType || "",
    liveEvent?.id || "",
    liveEvent?.type || "",
    liveEvent?.createdAt || "",
    match?.announcerBroadcastScoreSoundEffectsEnabled !== false ? "1" : "0",
    match?.announcerScoreSoundEffectsEnabled !== false ? "1" : "0",
    JSON.stringify(match?.announcerScoreSoundEffectMap || {}),
    Array.isArray(match?.balls) ? match.balls.length : 0,
  ]);
}

export function countLegalBallsLocal(history = []) {
  return (history || []).reduce((total, over) => {
    const balls = Array.isArray(over?.balls) ? over.balls : [];
    return (
      total +
      balls.filter(
        (ball) => ball?.extraType !== "wide" && ball?.extraType !== "noball",
      ).length
    );
  }, 0);
}

export function formatOversLeftLocal(match) {
  const totalBalls = Math.max(Number(match?.overs || 0), 0) * 6;
  const legalBalls = countLegalBallsLocal(match?.innings2?.history || []);
  const ballsLeft = Math.max(totalBalls - legalBalls, 0);
  const overs = Math.floor(ballsLeft / 6);
  const balls = ballsLeft % 6;
  return balls > 0 ? `${overs}.${balls} overs` : `${overs} overs`;
}

export function isSixBoundaryScoreEvent(event) {
  return Boolean(
    event?.type === "score_update" &&
    !event?.ball?.isOut &&
    !event?.ball?.extraType &&
    Number(event?.ball?.runs) === 6,
  );
}

export function estimateSpeechLeadDelayMs(text, rate = 1) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const safeRate = Math.max(0.7, Number(rate) || 1);
  const estimatedMs = Math.round(
    (Math.max(words, 1) / (180 * safeRate)) * 60000 + 250,
  );
  return Math.max(1600, Math.min(2600, estimatedMs));
}

export function estimateBoundaryLeadDelayMs(text, rate = 1) {
  return estimateSpeechLeadDelayMs(text, rate) + SIX_PRE_EFFECT_DELAY_MS;
}

export function getDerivedScoreSoundEffectDelayMs(
  event,
  announcerEnabled,
  announcerMode,
) {
  if (!event?.ball || !announcerEnabled || announcerMode === "silent") {
    return 0;
  }

  const leadText = buildSpectatorBallAnnouncement({
    ...event,
    type: "score_update",
  });
  const baseDelayMs = leadText
    ? estimateBoundaryLeadDelayMs(leadText, 0.78)
    : 0;
  const effectKey = getScoreSoundEffectEventKey(
    event?.ball?.runs,
    event?.ball?.isOut,
    event?.ball?.extraType,
  );

  if (effectKey === "wide_plus_one") {
    return baseDelayMs + SIX_PRE_EFFECT_DELAY_MS;
  }

  return baseDelayMs;
}

export function buildFallbackSoundEffectFromId(effectId = "") {
  const safeId = String(effectId || "").trim();
  if (!safeId || safeId === RANDOM_SCORE_EFFECT_ID) {
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

export function resolveSpectatorScoreSoundEffect(match, liveEvent) {
  const effectKey = getScoreSoundEffectEventKey(
    liveEvent?.ball?.runs,
    liveEvent?.ball?.isOut,
    liveEvent?.ball?.extraType,
  );
  if (!effectKey) {
    return null;
  }

  const configuredEffectId = String(
    match?.announcerScoreSoundEffectMap?.[effectKey] || "",
  ).trim();

  return buildFallbackSoundEffectFromId(configuredEffectId);
}
