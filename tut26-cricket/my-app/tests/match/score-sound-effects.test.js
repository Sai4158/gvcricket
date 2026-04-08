/**
 * File overview:
 * Purpose: Automated test coverage for Score Sound Effects.Test behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  getScoreSoundEffectMapSignature,
  getScoreSoundEffectEventKey,
  getScoreSoundEffectPreviewInput,
  normalizeScoreSoundEffectMap,
  SCORE_SOUND_EFFECT_KEYS,
  shouldHydrateScoreSoundEffectMapFromRemote,
} from "../../src/app/lib/score-sound-effects.js";
import {
  createMatchEndLiveEvent,
  createScoreLiveEvent,
  createSoundEffectLiveEvent,
} from "../../src/app/lib/live-announcements.js";
import { serializePublicMatch } from "../../src/app/lib/public-data.js";

test("[match] score sound effect mapping covers every supported scoring control", () => {
  const cases = [
    {
      key: "dot",
      input: { runs: 0, isOut: false, extraType: null },
    },
    {
      key: "one",
      input: { runs: 1, isOut: false, extraType: null },
    },
    {
      key: "two",
      input: { runs: 2, isOut: false, extraType: null },
    },
    {
      key: "three",
      input: { runs: 3, isOut: false, extraType: null },
    },
    {
      key: "four",
      input: { runs: 4, isOut: false, extraType: null },
    },
    {
      key: "six",
      input: { runs: 6, isOut: false, extraType: null },
    },
    {
      key: "out",
      input: { runs: 0, isOut: true, extraType: null },
    },
    {
      key: "wide_zero",
      input: { runs: 0, isOut: false, extraType: "wide" },
    },
    {
      key: "wide_plus_one",
      input: { runs: 1, isOut: false, extraType: "wide" },
    },
    {
      key: "noball",
      input: { runs: 0, isOut: false, extraType: "noball" },
    },
  ];

  assert.deepEqual(
    SCORE_SOUND_EFFECT_KEYS,
    cases.map((entry) => entry.key),
  );

  for (const entry of cases) {
    assert.equal(
      getScoreSoundEffectEventKey(
        entry.input.runs,
        entry.input.isOut,
        entry.input.extraType,
      ),
      entry.key,
    );
    assert.deepEqual(getScoreSoundEffectPreviewInput(entry.key), entry.input);
  }

  assert.equal(getScoreSoundEffectEventKey(5, false, null), "");
  assert.equal(getScoreSoundEffectPreviewInput("unknown"), null);
});

test("[match] remote score sound map hydration does not overwrite unsaved local changes", () => {
  const remoteMap = normalizeScoreSoundEffectMap({
    dot: "boom.mp3",
    out: "get_out.mp3",
  });
  const remoteSignature = getScoreSoundEffectMapSignature(remoteMap);

  assert.equal(
    shouldHydrateScoreSoundEffectMapFromRemote(remoteMap, "", false),
    true,
  );
  assert.equal(
    shouldHydrateScoreSoundEffectMapFromRemote(remoteMap, remoteSignature, false),
    false,
  );
  assert.equal(
    shouldHydrateScoreSoundEffectMapFromRemote(remoteMap, "", true),
    false,
  );
  assert.equal(
    shouldHydrateScoreSoundEffectMapFromRemote(
      normalizeScoreSoundEffectMap(),
      "",
      false,
    ),
    false,
  );
});

test("[match] score and sound effect live events preserve their shared action id", () => {
  const actionId = "score:test-action-1";
  const baseMatch = {
    innings1: { score: 12, history: [] },
  };
  const nextMatch = {
    ...baseMatch,
    innings: "second",
    score: 13,
    outs: 1,
    result: "",
    innings2: { team: "Beta", history: [] },
    teamAName: "Alpha",
    teamBName: "Beta",
  };
  const ball = { runs: 1, isOut: false, extraType: null };

  const scoreEvent = createScoreLiveEvent(baseMatch, nextMatch, ball, {
    actionId,
  });
  const matchEndEvent = createMatchEndLiveEvent(nextMatch, "Beta won by 1 wicket.", {
    actionId,
    ball,
  });
  const soundEvent = createSoundEffectLiveEvent(
    nextMatch,
    {
      id: "crowd.mp3",
      fileName: "crowd.mp3",
      label: "Crowd",
      src: "/audio/effects/crowd.mp3",
    },
    {
      sourceActionId: actionId,
      trigger: "score_boundary",
    },
  );

  assert.equal(scoreEvent.actionId, actionId);
  assert.equal(matchEndEvent.actionId, actionId);
  assert.deepEqual(matchEndEvent.ball, ball);
  assert.equal(soundEvent.sourceActionId, actionId);
});

test("[match] public match payload exposes normalized score sound effect map", () => {
  const publicMatch = serializePublicMatch({
    _id: "match-1",
    teamA: [],
    teamB: [],
    teamAName: "Alpha",
    teamBName: "Beta",
    overs: 2,
    sessionId: "session-1",
    tossWinner: "Alpha",
    tossDecision: "bat",
    score: 0,
    outs: 0,
    isOngoing: true,
    innings: "first",
    result: "",
    innings1: { team: "Alpha", score: 0, history: [] },
    innings2: { team: "Beta", score: 0, history: [] },
    balls: [],
    announcer: {
      scoreSoundEffectMap: {
        dot: "dot.mp3",
        four: "four.mp3",
      },
    },
  });

  assert.equal(publicMatch.announcerScoreSoundEffectMap.dot, "dot.mp3");
  assert.equal(publicMatch.announcerScoreSoundEffectMap.four, "four.mp3");
  assert.equal(publicMatch.announcerScoreSoundEffectMap.six, "");
});
