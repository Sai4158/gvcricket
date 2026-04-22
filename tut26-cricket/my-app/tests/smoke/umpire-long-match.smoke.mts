/**
 * File overview:
 * Purpose: Exercises a full 15-over umpire match with pending-result undo and image overlap behavior.
 * Main exports: module side effects only.
 * Major callers: focused umpire smoke runs.
 * Side effects: creates and cleans up temporary sessions, matches, and reports.
 * Read next: ./umpire-test-support.mts
 */

import assert from "node:assert/strict";

import {
  completeInnings,
  DEFAULT_OVERS,
  scoreBall,
  scoreSingles,
  readMatch,
  seedMatchImages,
  undoLast,
  UmpireSmokeEnvironment,
  uploadTinyImage,
  writeSmokeArtifact,
} from "./umpire-test-support.mts";

async function main() {
  const environment = new UmpireSmokeEnvironment();
  const report = {
    createdAt: new Date().toISOString(),
    scenarios: [] as any[],
  };

  try {
    const noImageMatch = await environment.createUmpireMatch({
      namePrefix: "Umpire Long No Image",
      overs: DEFAULT_OVERS,
    });

    await scoreSingles(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar, DEFAULT_OVERS * 6);
    const firstAdvance = await completeInnings(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar);
    assert.equal(firstAdvance.response.status, 200, "first innings should complete in long smoke");

    await scoreSingles(
      environment.baseUrl,
      noImageMatch.matchId,
      noImageMatch.umpireJar,
      DEFAULT_OVERS * 6 - 1,
    );

    const winningBall = await scoreBall(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar, {
      runs: 2,
    });
    assert.equal(winningBall.response.status, 200, "winning ball should save");

    const pendingUndo = await scoreBall(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar, {
      runs: 0,
      actionId: `losing-ball-${Date.now()}`,
    });
    assert.equal(pendingUndo.response.status, 409, "direct scoring after pending result should be blocked");

    const undoLastBall = await undoLast(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar);
    assert.equal(undoLastBall.response.status, 200, "pending result undo should work");

    const losingBall = await scoreBall(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar, {
      runs: 0,
    });
    assert.equal(losingBall.response.status, 200, "replacement final ball should save");

    const finalizeResult = await completeInnings(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar);
    assert.equal(finalizeResult.response.status, 200, "final result should finalize");

    const noImageFinal = await readMatch(environment.baseUrl, noImageMatch.matchId, noImageMatch.umpireJar);
    assert.equal(noImageFinal.response.status, 200, "final match payload should load");
    assert.equal(noImageFinal.json?.result, "Falcons won by 1 run.");

    report.scenarios.push({
      name: "long-no-image",
      matchId: noImageMatch.matchId,
      sessionId: noImageMatch.sessionId,
      result: noImageFinal.json?.result || "",
      finalScore: `${noImageFinal.json?.score || 0}/${noImageFinal.json?.outs || 0}`,
    });

    const imageMatch = await environment.createUmpireMatch({
      namePrefix: "Umpire Long With Image",
      overs: DEFAULT_OVERS,
    });
    await seedMatchImages(imageMatch.matchId, 12);
    await scoreSingles(environment.baseUrl, imageMatch.matchId, imageMatch.umpireJar, 12);

    let imageUploadStatus = "seed-only";
    if (process.env.IMGBB_API_KEY) {
      const uploadPromise = uploadTinyImage(environment.baseUrl, imageMatch.matchId, imageMatch.umpireJar);
      await scoreSingles(environment.baseUrl, imageMatch.matchId, imageMatch.umpireJar, 6);
      const uploadResult = await uploadPromise;
      imageUploadStatus = `${uploadResult.response.status}`;
    }

    const seededFinal = await readMatch(environment.baseUrl, imageMatch.matchId, imageMatch.umpireJar);
    assert.equal(seededFinal.response.status, 200, "seeded image match should still load");

    report.scenarios.push({
      name: "long-image-overlap",
      matchId: imageMatch.matchId,
      sessionId: imageMatch.sessionId,
      scoreAfterOverlap: `${seededFinal.json?.score || 0}/${seededFinal.json?.outs || 0}`,
      imageUploadStatus,
      imageCount: Array.isArray(seededFinal.json?.matchImages)
        ? seededFinal.json.matchImages.length
        : 0,
    });

    const artifactPath = await writeSmokeArtifact(
      "umpire-long-match-latest.json",
      report,
    );
    console.log(JSON.stringify({ artifactPath, report }, null, 2));
  } finally {
    await environment.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
