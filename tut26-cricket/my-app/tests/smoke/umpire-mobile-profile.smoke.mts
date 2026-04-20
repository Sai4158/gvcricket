/**
 * File overview:
 * Purpose: Profiles umpire scoring and undo on a mobile viewport with throttled network and CPU.
 * Main exports: module side effects only.
 * Major callers: focused umpire perf runs.
 * Side effects: opens a real browser, creates temporary matches, and writes a perf artifact.
 * Read next: ./umpire-test-support.mts
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

import {
  completeInnings,
  DEFAULT_OVERS,
  scoreSingles,
  seedMatchImages,
  UmpireSmokeEnvironment,
  uploadTinyImage,
  writeSmokeArtifact,
} from "./umpire-test-support.mts";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function prepareLongLiveMatch(
  environment: UmpireSmokeEnvironment,
  { withImages = false } = {},
) {
  const setup = await environment.createUmpireMatch({
    namePrefix: withImages ? "Browser Umpire With Images" : "Browser Umpire No Images",
    overs: DEFAULT_OVERS,
  });

  await scoreSingles(environment.baseUrl, setup.matchId, setup.umpireJar, DEFAULT_OVERS * 6);
  const firstAdvance = await completeInnings(environment.baseUrl, setup.matchId, setup.umpireJar);
  assert.equal(firstAdvance.response.status, 200, "browser prep should advance to second innings");
  await scoreSingles(environment.baseUrl, setup.matchId, setup.umpireJar, 60);

  if (withImages) {
    await seedMatchImages(setup.matchId, 12);
  }

  return setup;
}

async function configureMobileThrottle(page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 2 });
  await page.route("**/api/**", async (route) => {
    await page.waitForTimeout(150);
    await route.continue();
  });
}

async function readVisibleScore(page) {
  const scoreText = await page.evaluate(() => {
    const matches = [...document.body.innerText.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    return matches.length
      ? matches.map((match) => `${match[1]}/${match[2]}`).join("|")
      : "";
  });
  return String(scoreText || "");
}

async function readVisibleSnapshot(page) {
  const snapshot = await page.evaluate(() => document.body.innerText || "");
  return String(snapshot || "");
}

async function waitForScoreChange(page, previousSignature) {
  await page.waitForFunction(
    (prev) => {
      return (document.body.innerText || "") !== prev;
    },
    previousSignature,
    { timeout: 6000 },
  );
}

async function tapLocator(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ force: true });
}

async function measureScoreTap(page, matchId: string, buttonName: string) {
  const previousSignature = await readVisibleSnapshot(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/matches/${matchId}/score`),
  ).catch((error) => ({ __error: error }));

  const startedAt = performance.now();
  const button = page
    .locator("button.press-feedback.w-full")
    .filter({ hasText: new RegExp(`^${escapeRegex(buttonName)}$`) })
    .first();
  await tapLocator(page, button);
  try {
    await waitForScoreChange(page, previousSignature);
  } catch (error) {
    const currentSnapshot = await readVisibleSnapshot(page);
    const maybeResponse = await Promise.race([
      responsePromise,
      page.waitForTimeout(100).then(() => null),
    ]);
    throw new Error(
      `score tap "${buttonName}" did not change visible state within timeout. ` +
        `responseSeen=${Boolean(maybeResponse && !maybeResponse.__error)} ` +
        `snapshotChanged=${currentSnapshot !== previousSignature} ` +
        `before=${JSON.stringify(previousSignature.slice(0, 250))} ` +
        `after=${JSON.stringify(currentSnapshot.slice(0, 250))}`,
      { cause: error },
    );
  }
  const visibleMs = performance.now() - startedAt;
  const response = await responsePromise;
  if (response?.__error) {
    throw response.__error;
  }
  const networkMs = performance.now() - startedAt;

  return { visibleMs, networkMs };
}

async function measureUndoTap(page, matchId: string) {
  const previousSignature = await readVisibleSnapshot(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/matches/${matchId}/actions`),
  ).catch((error) => ({ __error: error }));

  const startedAt = performance.now();
  const button = page
    .locator("button.press-feedback")
    .filter({ hasText: /^Undo$/ })
    .first();
  await tapLocator(page, button);
  try {
    await waitForScoreChange(page, previousSignature);
  } catch (error) {
    const currentSnapshot = await readVisibleSnapshot(page);
    const maybeResponse = await Promise.race([
      responsePromise,
      page.waitForTimeout(100).then(() => null),
    ]);
    throw new Error(
      `undo tap did not change visible state within timeout. ` +
        `responseSeen=${Boolean(maybeResponse && !maybeResponse.__error)} ` +
        `snapshotChanged=${currentSnapshot !== previousSignature} ` +
        `before=${JSON.stringify(previousSignature.slice(0, 250))} ` +
        `after=${JSON.stringify(currentSnapshot.slice(0, 250))}`,
      { cause: error },
    );
  }
  const visibleMs = performance.now() - startedAt;
  const response = await responsePromise;
  if (response?.__error) {
    throw response.__error;
  }
  const networkMs = performance.now() - startedAt;

  return { visibleMs, networkMs };
}

function buildStats(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const pick = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)))];

  return {
    count: sorted.length,
    p95: pick(0.95) || 0,
    max: sorted[sorted.length - 1] || 0,
  };
}

async function runBrowserScenario(
  environment: UmpireSmokeEnvironment,
  browser,
  { name, withImages = false }: { name: string; withImages?: boolean },
) {
  const setup = await prepareLongLiveMatch(environment, { withImages });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  try {
    await context.addCookies(setup.umpireJar.toPlaywrightCookies(environment.baseUrl));
    const page = await context.newPage();

    const navStartedAt = performance.now();
    await page.goto(`${environment.baseUrl}/match/${setup.matchId}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator("button.press-feedback.w-full")
      .filter({ hasText: /^1$/ })
      .first()
      .waitFor({ state: "visible", timeout: 8000 });
    // On throttled mobile profiles, SSR markup can appear before the client handlers hydrate.
    // Give the score controls a short settle window so taps hit the live React tree.
    await page.waitForTimeout(2500);
    const shellVisibleMs = performance.now() - navStartedAt;
    await configureMobileThrottle(page);

    const scoreVisibleSamples: number[] = [];
    const scoreNetworkSamples: number[] = [];
    const undoVisibleSamples: number[] = [];
    const undoNetworkSamples: number[] = [];

    if (withImages && process.env.IMGBB_API_KEY) {
      void uploadTinyImage(environment.baseUrl, setup.matchId, setup.umpireJar);
    }

    for (const label of ["1", "2", "4", "6", "Dot", "3"]) {
      const timing = await measureScoreTap(page, setup.matchId, label);
      scoreVisibleSamples.push(timing.visibleMs);
      scoreNetworkSamples.push(timing.networkMs);
    }

    for (let index = 0; index < 3; index += 1) {
      if (index > 0) {
        await page.waitForTimeout(1100);
      }
      const timing = await measureUndoTap(page, setup.matchId);
      undoVisibleSamples.push(timing.visibleMs);
      undoNetworkSamples.push(timing.networkMs);
    }

    const report = {
      scenario: name,
      matchId: setup.matchId,
      shellVisibleMs,
      scoreVisible: buildStats(scoreVisibleSamples),
      scoreNetwork: buildStats(scoreNetworkSamples),
      undoVisible: buildStats(undoVisibleSamples),
      undoNetwork: buildStats(undoNetworkSamples),
    };

    assert.ok(
      report.scoreVisible.p95 <= 200,
      `${name} score visible p95 ${report.scoreVisible.p95.toFixed(2)}ms exceeded 200ms`,
    );
    assert.ok(
      report.undoVisible.p95 <= 250,
      `${name} undo visible p95 ${report.undoVisible.p95.toFixed(2)}ms exceeded 250ms`,
    );
    assert.ok(
      report.scoreNetwork.p95 <= 1500,
      `${name} score network p95 ${report.scoreNetwork.p95.toFixed(2)}ms exceeded 1500ms`,
    );
    assert.ok(
      shellVisibleMs <= 1200,
      `${name} shell visible ${shellVisibleMs.toFixed(2)}ms exceeded 1200ms`,
    );

    return report;
  } finally {
    await context.close();
  }
}

async function main() {
  const environment = new UmpireSmokeEnvironment();
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const scenarios = [
      await runBrowserScenario(environment, browser, {
        name: "browser-mobile-no-image",
      }),
      await runBrowserScenario(environment, browser, {
        name: "browser-mobile-with-images",
        withImages: true,
      }),
    ];

    const artifactPath = await writeSmokeArtifact(
      "umpire-mobile-profile-latest.json",
      {
        createdAt: new Date().toISOString(),
        scenarios,
      },
    );

    console.log(JSON.stringify({ artifactPath, scenarios }, null, 2));
  } finally {
    await browser.close();
    await environment.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
