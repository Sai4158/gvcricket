/**
 * File overview:
 * Purpose: Validation, schema hardening, and security header regression coverage.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import {
  Match,
  PIN_BURST_BLOCK_MS,
  HOME_LIVE_BANNER_MATCH_FILTER,
  applySecurityHeaders,
  assert,
  createMatchSchema,
  crypto,
  enforceSmartPinRateLimit,
  matchActionSchema,
  sessionCreateSchema,
  test,
} from "./security-test-helpers.js";

test("[security] validators reject unknown fields and malformed scoring payloads", () => {
  const invalidSession = sessionCreateSchema.safeParse({
    name: "League Final",
    extra: "nope",
  });
  assert.equal(invalidSession.success, false);

  const sanitizedSession = sessionCreateSchema.safeParse({
    name: "<b>League Final</b>",
    date: "<script>bad()</script>June 1",
  });
  assert.equal(sanitizedSession.success, true);
  assert.equal(sanitizedSession.data.name.includes("<"), false);
  assert.equal(sanitizedSession.data.date.includes("<"), false);

  const normalizedSession = sessionCreateSchema.safeParse({
    name: "Fal\u200Bcons\u202E XI",
    date: "  June\u00A01  ",
  });
  assert.equal(normalizedSession.success, true);
  assert.equal(normalizedSession.data.name, "Fal cons XI");
  assert.equal(normalizedSession.data.date, "June 1");

  const spammySession = sessionCreateSchema.safeParse({
    name: "!!!!!!!!!!",
  });
  assert.equal(spammySession.success, false);

  const sanitizedMatch = createMatchSchema.safeParse({
    sessionId: "507f1f77bcf86cd799439011",
    teamAName: "<b>Team A</b>",
    teamBName: "Team B",
    teamA: ["Ali\u200Bce", "Bea"],
    teamB: ["Cara", "Dina"],
    overs: 6,
  });
  assert.equal(sanitizedMatch.success, true);
  assert.equal(sanitizedMatch.data.teamAName, "Team A");
  assert.equal(sanitizedMatch.data.teamA[0], "Ali ce");

  const invalidAction = matchActionSchema.safeParse({
    actionId: "score:test-action",
    type: "score_ball",
    runs: { $gt: 1 },
    isOut: false,
    extraType: null,
  });
  assert.equal(invalidAction.success, false);
});


test("[security] home live banner match filter stays cast-safe for the Match result field", () => {
  assert.doesNotThrow(() => {
    Match.findOne(HOME_LIVE_BANNER_MATCH_FILTER).cast(Match);
  });
});


test("[security] smart pin rate limit blocks the fourth rapid attempt inside 10 seconds", () => {
  const key = `pin-burst-${crypto.randomBytes(6).toString("hex")}`;
  const baseNow = 1_710_000_000_000;

  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow,
    }).allowed,
    true,
  );
  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow + 1_000,
    }).allowed,
    true,
  );
  assert.equal(
    enforceSmartPinRateLimit({
      key,
      longLimit: 10,
      longWindowMs: 60 * 1000,
      longBlockMs: 60 * 1000,
      now: baseNow + 2_000,
    }).allowed,
    true,
  );

  const blockedAttempt = enforceSmartPinRateLimit({
    key,
    longLimit: 10,
    longWindowMs: 60 * 1000,
    longBlockMs: 60 * 1000,
    now: baseNow + 3_000,
  });

  assert.equal(blockedAttempt.allowed, false);
  assert.ok(blockedAttempt.retryAfterMs > 0);
  assert.ok(blockedAttempt.retryAfterMs <= PIN_BURST_BLOCK_MS);
});


test("[security] security headers include the required protection policy", () => {
  const headers = applySecurityHeaders(new Headers(), { isProduction: false });
  const contentSecurityPolicy = headers.get("content-security-policy") || "";
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /wss:\/\/\*\.edge\.agora\.io:\*/);
  assert.match(contentSecurityPolicy, /wss:\/\/\*\.edge\.sd-rtn\.com:\*/);
  assert.match(headers.get("permissions-policy"), /camera=\(\)/);
});
