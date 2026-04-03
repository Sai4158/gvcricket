import assert from "node:assert/strict";
import test from "node:test";

import {
  getScoreSoundEffectMapSignature,
  getScoreSoundEffectEventKey,
  getScoreSoundEffectPreviewInput,
  normalizeScoreSoundEffectMap,
  SCORE_SOUND_EFFECT_KEYS,
  shouldHydrateScoreSoundEffectMapFromRemote,
} from "../src/app/lib/score-sound-effects.js";

test("score sound effect mapping covers every supported scoring control", () => {
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

test("remote score sound map hydration does not overwrite unsaved local changes", () => {
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
