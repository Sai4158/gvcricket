/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: buildMatchScorePreview.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildSpectatorScoreAnnouncement,
  buildUmpireAnnouncement,
  buildUmpireStageAnnouncement,
  createScoreLiveEvent,
} from "../../../lib/live-announcements";
import { applyMatchAction } from "../../../lib/match-engine";
import { countLegalBalls } from "../../../lib/match-scoring";
import { getTotalDismissalsAllowed } from "../../../lib/team-utils";

export function buildMatchScorePreview({
  extraType = null,
  isOut = false,
  match,
  mode = "simple",
  runs = 0,
} = {}) {
  if (!match) {
    return {
      nextMatch: match,
      event: null,
      sequence: { items: [], priority: 2 },
      leadItem: null,
      followUpItems: [],
      endsFirstInnings: false,
    };
  }

  let nextMatch = match;
  try {
    nextMatch = applyMatchAction(match, {
      actionId: `umpire-preview:${Date.now()}`,
      type: "score_ball",
      runs,
      isOut,
      extraType,
    });
  } catch {
    nextMatch = match;
  }

  const event = createScoreLiveEvent(match, nextMatch || match, {
    runs,
    isOut,
    extraType,
  });
  const baseSequence = buildLiveScoreAnnouncementSequence(
    event,
    nextMatch || match,
    mode,
  );
  const umpireLeadText =
    buildUmpireAnnouncement(event, mode) ||
    baseSequence.items?.[0]?.text ||
    "";
  const nextInningsHistory = nextMatch?.innings1?.history ?? [];
  const nextLegalBalls = countLegalBalls(nextInningsHistory);
  const nextOversDone =
    nextMatch?.innings === "first" &&
    nextLegalBalls >= Number(nextMatch?.overs || 0) * 6;
  const nextMaxWickets = getTotalDismissalsAllowed(nextMatch || match);
  const nextAllOut =
    nextMatch?.innings === "first" &&
    nextMaxWickets > 0 &&
    Number(nextMatch?.outs || 0) >= nextMaxWickets;
  const endsFirstInnings = Boolean(
    nextMatch?.innings === "first" &&
      !nextMatch?.result &&
      (nextOversDone || nextAllOut),
  );

  let sequence = {
    ...baseSequence,
    items: umpireLeadText
      ? [
          {
            ...(baseSequence.items?.[0] || {
              pauseAfterMs: 0,
              rate: 0.78,
            }),
            text: umpireLeadText,
          },
          ...(baseSequence.items?.slice(1) || []),
        ]
      : baseSequence.items || [],
  };

  if (endsFirstInnings) {
    const inningsStageText =
      buildUmpireStageAnnouncement(nextMatch || match) ||
      "First innings complete.";
    const inningsCompleteItem = {
      text: inningsStageText,
      pauseAfterMs: 0,
      rate: 0.79,
    };

    sequence = {
      ...sequence,
      items: sequence.items?.length
        ? [sequence.items[0], inningsCompleteItem]
        : [inningsCompleteItem],
      priority: 4,
      restoreAfterMs: 2200,
    };
  }

  const leadItem = sequence.items?.[0] || null;
  const followUpItems = sequence.items?.slice(1) || [];

  if (!followUpItems.length && !endsFirstInnings) {
    const followUpText =
      buildSpectatorScoreAnnouncement(event, nextMatch || match) ||
      buildCurrentScoreAnnouncement(nextMatch || match);
    if (followUpText) {
      followUpItems.push({
        text: followUpText,
        pauseAfterMs: 0,
        rate: 0.8,
      });
    }
  }

  return {
    nextMatch: nextMatch || match,
    event,
    sequence,
    leadItem,
    followUpItems,
    endsFirstInnings,
  };
}


