/**
 * File overview:
 * Purpose: Covers Umpire Match Flow.Smoke behavior and regression cases in the automated test suite.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: ./README.md
 */

import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3031";

class CookieJar {
  private cookies = new Map<string, string>();

  addFromResponse(response: Response) {
    const getSetCookie = (response.headers as Headers & {
      getSetCookie?: () => string[];
    }).getSetCookie;
    const rawCookies = typeof getSetCookie === "function" ? getSetCookie.call(response.headers) : [];

    for (const rawCookie of rawCookies) {
      const firstPart = rawCookie.split(";")[0];
      const separatorIndex = firstPart.indexOf("=");
      if (separatorIndex <= 0) continue;
      const name = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function request(path: string, init: RequestInit = {}, jar?: CookieJar) {
  const headers = new Headers(init.headers || {});
  headers.set("origin", BASE_URL);
  headers.set("referer", `${BASE_URL}/`);
  if (jar) {
    const cookieHeader = jar.header();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });

  if (jar) {
    jar.addFromResponse(response);
  }

  return response;
}

async function json(path: string, init: RequestInit = {}, jar?: CookieJar) {
  const response = await request(path, init, jar);
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

function actionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const anonymous = new CookieJar();
  const umpire = new CookieJar();

  const homeResponse = await request("/");
  assert.equal(homeResponse.status, 200, "home page should load");

  const createPageResponse = await request("/session/new");
  assert.equal(createPageResponse.status, 200, "create page should load");

  const createResult = await json(
    "/api/sessions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: `Umpire Flow ${Date.now()}`,
      }),
    },
    anonymous
  );
  assert.equal(createResult.response.status, 201, "session creation should work");
  const sessionId = String(createResult.body._id);
  const draftToken = String(createResult.body.draftToken);

  const teamsPageResponse = await request(`/teams/${sessionId}`);
  assert.equal(teamsPageResponse.status, 200, "teams page should load");

  const setupResult = await json(
    `/api/sessions/${sessionId}/setup-match`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        teamAName: "Red",
        teamBName: "Blue",
        teamAPlayers: ["A1", "A2", "A3"],
        teamBPlayers: ["B1", "B2", "B3"],
        overs: 1,
        draftToken,
      }),
    },
    anonymous
  );
  assert.equal(setupResult.response.status, 201, "draft setup should save");

  const tossPageResponse = await request(`/toss/${sessionId}`);
  assert.equal(tossPageResponse.status, 200, "toss page should load");

  const startResult = await json(
    `/api/sessions/${sessionId}/start-match`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        teamAName: "Red",
        teamBName: "Blue",
        teamAPlayers: ["A1", "A2", "A3"],
        teamBPlayers: ["B1", "B2", "B3"],
        overs: 1,
        tossWinner: "Red",
        tossDecision: "bat",
        draftToken,
      }),
    },
    umpire
  );
  assert.equal(startResult.response.status, 201, "start-match should create a real match");
  assert.ok(startResult.body?.match?._id, "real match id should be returned");
  const matchId = String(startResult.body.match._id);

  const matchPageResponse = await request(`/match/${matchId}`);
  assert.equal(matchPageResponse.status, 200, "match page should load");

  const authResult = await json(
    `/api/matches/${matchId}/auth`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pin: "0000",
      }),
    },
    umpire
  );
  assert.equal(authResult.response.status, 200, "umpire auth should work");

  const scoreSequence = [
    { type: "score_ball", runs: 0, isOut: false, extraType: null },
    { type: "score_ball", runs: 1, isOut: false, extraType: null },
    { type: "score_ball", runs: 2, isOut: false, extraType: null },
    { type: "score_ball", runs: 1, isOut: false, extraType: "wide" },
    { type: "score_ball", runs: 1, isOut: false, extraType: "noball" },
    { type: "score_ball", runs: 0, isOut: true, extraType: null },
  ];

  for (const [index, action] of scoreSequence.entries()) {
    const result = await json(
      `/api/matches/${matchId}/score`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actionId: actionId(`first-${index}`),
          runs: action.runs,
          isOut: action.isOut,
          extraType: action.extraType,
        }),
      },
      umpire
    );
    assert.equal(result.response.status, 200, `first innings action ${index} should work`);
  }

  const undoResult = await json(
    `/api/matches/${matchId}/actions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "undo_last",
        actionId: actionId("undo-out"),
      }),
    },
    umpire
  );
  assert.equal(undoResult.response.status, 200, "undo should work");

  for (const [index, action] of [
    { type: "score_ball", runs: 0, isOut: true, extraType: null },
    { type: "score_ball", runs: 4, isOut: false, extraType: null },
    { type: "score_ball", runs: 6, isOut: false, extraType: null },
  ].entries()) {
    const result = await json(
      `/api/matches/${matchId}/score`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actionId: actionId(`first-finish-${index}`),
          runs: action.runs,
          isOut: action.isOut,
          extraType: action.extraType,
        }),
      },
      umpire
    );
    assert.equal(result.response.status, 200, `first innings finishing action ${index} should work`);
  }

  const patchResult = await json(
    `/api/matches/${matchId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        teamAName: "Red Rockets",
        teamBName: "Blue Blazers",
        teamA: ["A1 Prime", "A2 Prime", "A3 Prime"],
        teamB: ["B1 Prime", "B2 Prime", "B3 Prime"],
      }),
    },
    umpire
  );
  assert.equal(patchResult.response.status, 200, "mid-match patch should work");

  const completeFirstInnings = await json(
    `/api/matches/${matchId}/actions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "complete_innings",
        actionId: actionId("complete-first"),
      }),
    },
    umpire
  );
  assert.equal(completeFirstInnings.response.status, 200, "first innings should complete");
  assert.equal(completeFirstInnings.body.match.innings, "second", "second innings should begin");

  const secondInningsPatchResult = await json(
    `/api/matches/${matchId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        overs: 2,
      }),
    },
    umpire
  );
  assert.equal(secondInningsPatchResult.response.status, 200, "overs patch should work in second innings");

  const secondInningsActions = [
    { type: "score_ball", runs: 4, isOut: false, extraType: null },
    { type: "undo_last" },
    { type: "score_ball", runs: 6, isOut: false, extraType: null },
    { type: "score_ball", runs: 3, isOut: false, extraType: null },
    { type: "score_ball", runs: 0, isOut: true, extraType: null },
    { type: "score_ball", runs: 2, isOut: false, extraType: null },
    { type: "score_ball", runs: 1, isOut: false, extraType: "wide" },
    { type: "score_ball", runs: 1, isOut: false, extraType: "noball" },
    { type: "score_ball", runs: 1, isOut: false, extraType: null },
    { type: "score_ball", runs: 2, isOut: false, extraType: null },
  ];

  for (const [index, action] of secondInningsActions.entries()) {
    const result = await json(
      action.type === "score_ball"
        ? `/api/matches/${matchId}/score`
        : `/api/matches/${matchId}/actions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actionId: actionId(`second-${index}`),
          ...(action.type === "score_ball"
            ? {
                runs: action.runs,
                isOut: action.isOut,
                extraType: action.extraType,
              }
            : {
                type: action.type,
              }),
        }),
      },
      umpire
    );
    assert.equal(result.response.status, 200, `second innings action ${index} should work`);
  }

  const matchDataResult = await json(`/api/matches/${matchId}`, {}, umpire);
  assert.equal(matchDataResult.response.status, 200, "match data should load");
  assert.equal(matchDataResult.body.teamAName, "Red Rockets", "mid-match team A rename should persist");
  assert.equal(matchDataResult.body.teamBName, "Blue Blazers", "mid-match team B rename should persist");
  assert.equal(matchDataResult.body.overs, 2, "overs change should persist");
  assert.equal(matchDataResult.body.result, "Blue Blazers won by 2 wickets.", "winner should be correct");
  assert.equal(matchDataResult.body.isOngoing, false, "match should end after chase");

  const sessionIndexResult = await json("/api/sessions", {}, anonymous);
  assert.equal(sessionIndexResult.response.status, 200, "sessions index should load");
  const indexedSession = sessionIndexResult.body.find((session: any) => String(session._id) === sessionId);
  assert.ok(indexedSession, "new session should appear in session index");
  assert.equal(indexedSession.match, matchId, "session should point to real match");
  assert.equal(indexedSession.tossReady, true, "session should stay toss-ready");

  const spectatorPageResponse = await request(`/session/${sessionId}/view`);
  assert.equal(spectatorPageResponse.status, 307, "completed spectator route should redirect");
  assert.equal(
    spectatorPageResponse.headers.get("location"),
    `/result/${matchId}`,
    "completed spectator route should redirect to the result page"
  );

  const resultPageResponse = await request(`/result/${matchId}`);
  assert.equal(resultPageResponse.status, 200, "result page should load");

  const resultPageHtml = await resultPageResponse.text();
  assert.match(resultPageHtml, /Blue Blazers/, "result page should include updated team name");

  console.log(
    JSON.stringify(
      {
        sessionId,
        matchId,
        result: matchDataResult.body.result,
        finalScore: `${matchDataResult.body.score}/${matchDataResult.body.outs}`,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


