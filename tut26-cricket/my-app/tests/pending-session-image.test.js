import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingSessionImageNotice,
  getPendingSessionImageNotice,
  PENDING_SESSION_IMAGE_KEY,
  setPendingSessionImageNotice,
  uploadSessionImageFileToDraftSession,
  uploadStoredPendingSessionImageToDraftSession,
  uploadStoredPendingSessionImageToMatch,
} from "../src/app/lib/pending-session-image.js";

function createSessionStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function setPendingImage(sessionStorage) {
  sessionStorage.setItem(
    PENDING_SESSION_IMAGE_KEY,
    JSON.stringify({
      fileName: "cover.png",
      type: "image/png",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    })
  );
}

test("stored pending session image clears only after a successful match upload", async () => {
  const previousWindow = global.window;
  const previousFetch = global.fetch;
  const nativeFetch = previousFetch;
  const sessionStorage = createSessionStorageMock();
  const fetchCalls = [];

  global.window = { sessionStorage };
  setPendingImage(sessionStorage);

  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("data:")) {
      return nativeFetch(input, init);
    }

    fetchCalls.push(url);
    return new Response("", { status: 200 });
  };

  try {
    const didUpload = await uploadStoredPendingSessionImageToMatch({
      matchId: "match-1",
    });

    assert.equal(didUpload, true);
    assert.deepEqual(fetchCalls, ["/api/matches/match-1/image"]);
    assert.equal(sessionStorage.getItem(PENDING_SESSION_IMAGE_KEY), null);
  } finally {
    global.fetch = previousFetch;
    global.window = previousWindow;
  }
});

test("stored pending session image clears only after a successful draft upload", async () => {
  const previousWindow = global.window;
  const previousFetch = global.fetch;
  const nativeFetch = previousFetch;
  const sessionStorage = createSessionStorageMock();
  const fetchCalls = [];

  global.window = { sessionStorage };
  setPendingImage(sessionStorage);

  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("data:")) {
      return nativeFetch(input, init);
    }

    fetchCalls.push(url);
    return new Response("", { status: 200 });
  };

  try {
    const didUpload = await uploadStoredPendingSessionImageToDraftSession({
      sessionId: "session-1",
      draftToken: "draft-token-1",
    });

    assert.equal(didUpload, true);
    assert.deepEqual(fetchCalls, ["/api/sessions/session-1/image"]);
    assert.equal(sessionStorage.getItem(PENDING_SESSION_IMAGE_KEY), null);
  } finally {
    global.fetch = previousFetch;
    global.window = previousWindow;
  }
});

test("stored pending session image stays queued when the deferred match upload fails", async () => {
  const previousWindow = global.window;
  const previousFetch = global.fetch;
  const nativeFetch = previousFetch;
  const sessionStorage = createSessionStorageMock();

  global.window = { sessionStorage };
  setPendingImage(sessionStorage);

  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("data:")) {
      return nativeFetch(input, init);
    }

    return new Response("", { status: 500 });
  };

  try {
    const didUpload = await uploadStoredPendingSessionImageToMatch({
      matchId: "match-2",
    });

    assert.equal(didUpload, false);
    assert.notEqual(sessionStorage.getItem(PENDING_SESSION_IMAGE_KEY), null);
  } finally {
    global.fetch = previousFetch;
    global.window = previousWindow;
  }
});

test("stored pending session image stays queued when the draft upload fails", async () => {
  const previousWindow = global.window;
  const previousFetch = global.fetch;
  const nativeFetch = previousFetch;
  const sessionStorage = createSessionStorageMock();

  global.window = { sessionStorage };
  setPendingImage(sessionStorage);

  global.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("data:")) {
      return nativeFetch(input, init);
    }

    return new Response("", { status: 500 });
  };

  try {
    const didUpload = await uploadStoredPendingSessionImageToDraftSession({
      sessionId: "session-2",
      draftToken: "draft-token-2",
    });

    assert.equal(didUpload, false);
    assert.notEqual(sessionStorage.getItem(PENDING_SESSION_IMAGE_KEY), null);
  } finally {
    global.fetch = previousFetch;
    global.window = previousWindow;
  }
});

test("direct draft upload surfaces the server error message", async () => {
  const previousFetch = global.fetch;

  global.fetch = async () =>
    new Response(JSON.stringify({ message: "Draft access denied." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () =>
        uploadSessionImageFileToDraftSession({
          sessionId: "session-3",
          draftToken: "draft-token-3",
          file: new File(["hello"], "cover.jpg", { type: "image/jpeg" }),
        }),
      /Draft access denied\./
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("session image fallback notices persist until cleared", () => {
  const previousWindow = global.window;
  const sessionStorage = createSessionStorageMock();

  global.window = { sessionStorage };

  try {
    setPendingSessionImageNotice(
      "session-4",
      "Match image could not upload yet. Match setup can continue."
    );

    assert.equal(
      getPendingSessionImageNotice("session-4"),
      "Match image could not upload yet. Match setup can continue."
    );

    clearPendingSessionImageNotice("session-4");
    assert.equal(getPendingSessionImageNotice("session-4"), "");
  } finally {
    global.window = previousWindow;
  }
});
