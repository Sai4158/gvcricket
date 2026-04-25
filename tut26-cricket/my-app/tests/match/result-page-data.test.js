/**
 * File overview:
 * Purpose: Covers result page state normalization for media-only updates.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ../../src/app/components/result/result-page-data.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeResultMatchUpdate,
  normalizeResultMatch,
} from "../../src/app/components/result/result-page-data.js";

function buildResultMatchFixture() {
  return {
    _id: "507f1f77bcf86cd799439311",
    score: 94,
    outs: 7,
    result: "Titans won by 3 wickets.",
    matchImageUrl: "https://example.com/original.jpg",
    liveStream: {
      provider: "youtube",
      watchUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&playsinline=1",
      videoId: "M7lc1UVf-VE",
    },
    matchImages: [
      {
        id: "cover",
        url: "https://example.com/original.jpg",
      },
    ],
    innings1: {
      team: "Falcons",
      score: 92,
      history: [{ overNumber: 1, balls: [{ runs: 4, isOut: false }] }],
    },
    innings2: {
      team: "Titans",
      score: 94,
      history: [{ overNumber: 1, balls: [{ runs: 6, isOut: false }] }],
    },
  };
}

test("[match] result page merge keeps innings state when upload returns a media-only patch", () => {
  const currentMatch = buildResultMatchFixture();
  const mergedMatch = mergeResultMatchUpdate(currentMatch, {
    matchImageUrl: "https://example.com/updated.jpg",
    matchImages: [
      {
        id: "cover",
        url: "https://example.com/updated.jpg",
      },
      {
        id: "gallery-2",
        url: "https://example.com/gallery-2.jpg",
      },
    ],
    mediaVersion: "2026-04-23T15:00:00.000Z",
  });

  assert.equal(mergedMatch.innings1.team, "Falcons");
  assert.equal(mergedMatch.innings2.team, "Titans");
  assert.equal(mergedMatch.result, "Titans won by 3 wickets.");
  assert.equal(mergedMatch.matchImageUrl, "https://example.com/updated.jpg");
  assert.equal(mergedMatch.matchImages.length, 2);
  assert.equal(mergedMatch.liveStream.videoId, "M7lc1UVf-VE");
});

test("[match] result page merge keeps scorecard state when delete returns an empty media patch", () => {
  const currentMatch = buildResultMatchFixture();
  const mergedMatch = mergeResultMatchUpdate(currentMatch, {
    matchImageUrl: "",
    matchImages: [],
    mediaVersion: "2026-04-23T15:05:00.000Z",
  });

  assert.equal(mergedMatch.innings1.team, "Falcons");
  assert.equal(mergedMatch.innings2.team, "Titans");
  assert.equal(mergedMatch.score, 94);
  assert.equal(mergedMatch.matchImageUrl, "");
  assert.deepEqual(mergedMatch.matchImages, []);
  assert.equal(mergedMatch.liveStream.videoId, "M7lc1UVf-VE");
});

test("[match] result page normalization fills missing innings shells safely", () => {
  const normalizedMatch = normalizeResultMatch({
    _id: "507f1f77bcf86cd799439312",
    matchImageUrl: "",
  });

  assert.equal(normalizedMatch.innings1.team, "");
  assert.equal(normalizedMatch.innings2.team, "");
  assert.equal(normalizedMatch.innings1.score, 0);
  assert.equal(normalizedMatch.innings2.score, 0);
  assert.deepEqual(normalizedMatch.matchImages, []);
  assert.equal(normalizedMatch.liveStream, null);
});

test("[match] result page normalization keeps valid live stream payloads only", () => {
  const normalizedMatch = normalizeResultMatch({
    _id: "507f1f77bcf86cd799439313",
    liveStream: {
      provider: "youtube",
      watchUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&playsinline=1",
      videoId: "M7lc1UVf-VE",
    },
  });

  assert.equal(normalizedMatch.liveStream.videoId, "M7lc1UVf-VE");
});
