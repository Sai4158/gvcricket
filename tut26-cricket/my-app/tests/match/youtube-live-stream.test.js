import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionMirrorUpdate,
} from "../../src/app/lib/match-engine.js";
import { serializePublicMatch, serializeSessionViewBootstrap } from "../../src/app/lib/public-data.js";
import {
  normalizeStoredLiveStream,
  normalizeYouTubeLiveStream,
} from "../../src/app/lib/youtube-live-stream.js";
import { buildBaseMatchFixture } from "../helpers/match-fixtures.js";

function buildMatch() {
  return buildBaseMatchFixture({
    _id: "507f1f77bcf86cd799439321",
    sessionId: "507f1f77bcf86cd799439322",
    updatedAt: new Date("2026-04-24T14:00:00.000Z"),
  });
}

test("[match] youtube live stream normalizes watch and share links into public embed data", () => {
  const watchUrl = normalizeYouTubeLiveStream(
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  );
  const shareUrl = normalizeYouTubeLiveStream("https://youtu.be/M7lc1UVf-VE");

  assert.equal(watchUrl.ok, true);
  assert.equal(shareUrl.ok, true);
  assert.equal(watchUrl.value.videoId, "M7lc1UVf-VE");
  assert.equal(shareUrl.value.videoId, "M7lc1UVf-VE");
  assert.match(watchUrl.value.embedUrl, /youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
  assert.equal(shareUrl.value.watchUrl, "https://www.youtube.com/watch?v=M7lc1UVf-VE");
});

test("[match] invalid youtube links are rejected and stored live stream shells are repaired", () => {
  const invalid = normalizeYouTubeLiveStream("https://example.com/live/123");
  assert.equal(invalid.ok, false);

  const repaired = normalizeStoredLiveStream({
    provider: "youtube",
    inputUrl: "https://www.youtube.com/live/M7lc1UVf-VE",
  });

  assert.equal(repaired.videoId, "M7lc1UVf-VE");
  assert.equal(repaired.watchUrl, "https://www.youtube.com/watch?v=M7lc1UVf-VE");
});

test("[match] public serializers keep live stream data while scoring data stays intact", () => {
  const match = {
    ...buildMatch(),
    score: 58,
    outs: 4,
    innings: "second",
    innings1: {
      team: "Falcons",
      score: 57,
      history: [],
    },
    innings2: {
      team: "Titans",
      score: 58,
      history: [],
    },
    liveStream: {
      provider: "youtube",
      inputUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      watchUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&playsinline=1",
      videoId: "M7lc1UVf-VE",
      updatedAt: "2026-04-24T14:05:00.000Z",
    },
  };

  const publicMatch = serializePublicMatch(match);
  const spectatorMatch = serializeSessionViewBootstrap(match);
  const sessionMirror = buildSessionMirrorUpdate(match);

  assert.equal(publicMatch.score, 58);
  assert.equal(publicMatch.outs, 4);
  assert.equal(publicMatch.liveStream.videoId, "M7lc1UVf-VE");
  assert.equal(spectatorMatch.liveStream.watchUrl, "https://www.youtube.com/watch?v=M7lc1UVf-VE");
  assert.equal(sessionMirror.liveStream.videoId, "M7lc1UVf-VE");
});
