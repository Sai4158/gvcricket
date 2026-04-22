/**
 * File overview:
 * Purpose: Measures umpire hot-path route latency and payload size under long-match conditions.
 * Main exports: module side effects only.
 * Major callers: focused perf runs and CI smoke checks.
 * Side effects: creates temporary matches and writes perf artifacts.
 * Read next: ./umpire-test-support.mts
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  api,
  createActionId,
  DEFAULT_OVERS,
  measureStats,
  openSse,
  scoreBall,
  scoreSingles,
  seedMatchImages,
  UmpireSmokeEnvironment,
  undoLast,
  uploadTinyImage,
  writeSmokeArtifact,
} from "./umpire-test-support.mts";

async function measureCall<T>(samples: number[], operation: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await operation();
  samples.push(performance.now() - startedAt);
  return result;
}

function assertThreshold(stats: ReturnType<typeof measureStats>, threshold: { p95: number; max: number }, label: string) {
  assert.ok(
    stats.p95 <= threshold.p95,
    `${label} p95 ${stats.p95.toFixed(2)}ms exceeded ${threshold.p95}ms`
  );
  assert.ok(
    stats.max <= threshold.max,
    `${label} max ${stats.max.toFixed(2)}ms exceeded ${threshold.max}ms`
  );
}

async function runScenario(
  environment: UmpireSmokeEnvironment,
  {
    name,
    seedImages = false,
    measureUploadOverlap = false,
  }: {
    name: string;
    seedImages?: boolean;
    measureUploadOverlap?: boolean;
  },
) {
  const setup = await environment.createUmpireMatch({
    namePrefix: name,
    overs: DEFAULT_OVERS,
  });

  if (seedImages) {
    await seedMatchImages(setup.matchId, 12);
  }

  // Warm the dedicated hot routes before measuring latency on the dev server.
  const warmScore = await scoreBall(environment.baseUrl, setup.matchId, setup.umpireJar, {
    runs: 1,
    actionId: createActionId(`${name}-warm-score`),
  });
  assert.equal(warmScore.response.status, 200, "warm score should succeed");
  const warmUndo = await undoLast(environment.baseUrl, setup.matchId, setup.umpireJar);
  assert.equal(warmUndo.response.status, 200, "warm undo should succeed");

  await scoreSingles(environment.baseUrl, setup.matchId, setup.umpireJar, 24);

  const scoreSamples: number[] = [];
  const undoSamples: number[] = [];
  const matchFetchSamples: number[] = [];
  const scoreDuringUploadSamples: number[] = [];

  const liveStream = await openSse(environment.baseUrl, `/api/live/matches/${setup.matchId}`, setup.umpireJar);
  const liveStartedAt = performance.now();
  let firstEvent = await liveStream.nextEvent(8000);
  while (firstEvent.event !== "match") {
    firstEvent = await liveStream.nextEvent(8000);
  }
  const liveBootstrapMs = performance.now() - liveStartedAt;

  for (let index = 0; index < 24; index += 1) {
    const scoreResult = await measureCall(scoreSamples, () =>
      scoreBall(environment.baseUrl, setup.matchId, setup.umpireJar, {
        runs: index % 6 === 0 ? 4 : 1,
        actionId: createActionId(`perf-score-${index}`),
      }),
    );
    assert.equal(scoreResult.response.status, 200, `score ${index} should succeed`);

    if ((index + 1) % 6 === 0) {
      const undoResult = await measureCall(undoSamples, () =>
        undoLast(environment.baseUrl, setup.matchId, setup.umpireJar),
      );
      assert.equal(undoResult.response.status, 200, `undo ${index} should succeed`);
    }

    const fetchResult = await measureCall(matchFetchSamples, () =>
      api(environment.baseUrl, `/api/matches/${setup.matchId}`, {
        jar: setup.umpireJar,
      }),
    );
    assert.equal(fetchResult.response.status, 200, "match fetch should succeed");
  }

  let uploadStatus = "not-run";
  if (measureUploadOverlap && process.env.IMGBB_API_KEY) {
    const uploadPromise = uploadTinyImage(environment.baseUrl, setup.matchId, setup.umpireJar);

    for (let index = 0; index < 8; index += 1) {
      const overlappedScore = await measureCall(scoreDuringUploadSamples, () =>
        scoreBall(environment.baseUrl, setup.matchId, setup.umpireJar, {
          runs: 1,
          actionId: createActionId(`upload-score-${index}`),
        }),
      );
      assert.equal(overlappedScore.response.status, 200, "score during upload should succeed");
    }

    const uploadResult = await uploadPromise;
    uploadStatus = String(uploadResult.response.status);
  }

  liveStream.close();

  const report = {
    scenario: name,
    matchId: setup.matchId,
    sessionId: setup.sessionId,
    liveBootstrapMs,
    liveBootstrapBytes: firstEvent.payloadBytes,
    score: measureStats(scoreSamples),
    undo: measureStats(undoSamples),
    matchFetch: measureStats(matchFetchSamples),
    scoreDuringUpload:
      scoreDuringUploadSamples.length > 0 ? measureStats(scoreDuringUploadSamples) : null,
    uploadStatus,
  };

  assertThreshold(report.score, { p95: 350, max: 750 }, `${name} /score`);
  assertThreshold(report.undo, { p95: 450, max: 900 }, `${name} undo`);
  if (report.scoreDuringUpload) {
    assert.ok(
      report.scoreDuringUpload.p95 <= 600,
      `${name} score during upload p95 ${report.scoreDuringUpload.p95.toFixed(2)}ms exceeded 600ms`,
    );
  }

  return report;
}

async function main() {
  const environment = new UmpireSmokeEnvironment();

  try {
    const scenarios = [
      await runScenario(environment, {
        name: "umpire-hot-path-no-image",
      }),
      await runScenario(environment, {
        name: "umpire-hot-path-seeded-gallery",
        seedImages: true,
        measureUploadOverlap: true,
      }),
    ];

    const artifactPath = await writeSmokeArtifact(
      "umpire-hot-path-perf-latest.json",
      {
        createdAt: new Date().toISOString(),
        scenarios,
      },
    );

    console.log(JSON.stringify({ artifactPath, scenarios }, null, 2));
  } finally {
    await environment.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
