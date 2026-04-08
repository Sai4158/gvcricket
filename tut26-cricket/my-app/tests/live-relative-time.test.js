/**
 * File overview:
 * Purpose: Automated test coverage for Live Relative Time.Test behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  formatLiveRelativeTimeLabel,
  getLiveRelativeTimeRefreshDelay,
  parseLiveRelativeTimeTimestamp,
} from "../src/app/components/live/useLiveRelativeTime.js";

test("live relative time helpers handle invalid timestamps safely", () => {
  assert.equal(parseLiveRelativeTimeTimestamp(""), null);
  assert.equal(parseLiveRelativeTimeTimestamp("not-a-date"), null);
  assert.equal(formatLiveRelativeTimeLabel("not-a-date", 0), "Waiting for update");
  assert.equal(getLiveRelativeTimeRefreshDelay("not-a-date", 0), null);
});

test("live relative time refresh delay slows down after the first minute and hour", () => {
  const baseNow = Date.parse("2026-03-25T12:00:00.000Z");

  assert.equal(
    getLiveRelativeTimeRefreshDelay("2026-03-25T11:59:50.000Z", baseNow),
    5000,
  );
  assert.equal(
    getLiveRelativeTimeRefreshDelay("2026-03-25T11:58:30.000Z", baseNow),
    30000,
  );
  assert.equal(
    getLiveRelativeTimeRefreshDelay("2026-03-25T10:55:00.000Z", baseNow),
    300000,
  );
});

test("live relative time labels stay accurate across seconds minutes and hours", () => {
  const baseNow = Date.parse("2026-03-25T12:00:00.000Z");

  assert.equal(
    formatLiveRelativeTimeLabel("2026-03-25T11:59:58.000Z", baseNow),
    "Updated just now",
  );
  assert.equal(
    formatLiveRelativeTimeLabel("2026-03-25T11:59:20.000Z", baseNow),
    "Updated 40s ago",
  );
  assert.equal(
    formatLiveRelativeTimeLabel("2026-03-25T11:40:00.000Z", baseNow),
    "Updated 20m ago",
  );
  assert.equal(
    formatLiveRelativeTimeLabel("2026-03-25T09:55:00.000Z", baseNow),
    "Updated 2h ago",
  );
});
