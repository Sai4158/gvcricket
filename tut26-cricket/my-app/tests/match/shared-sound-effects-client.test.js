/**
 * File overview:
 * Purpose: Automated test coverage for Sound Effects Client.Test behavior and regressions.
 * Main exports: module side effects only.
 * Major callers: `npm test` and focused test runs.
 * Side effects: runs assertions and test-side setup/teardown only.
 * Read next: README.md
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSoundEffectsByQuery,
  subscribeSoundEffectsLibrarySync,
  writeCachedSoundEffectsLibrary,
  writeCachedSoundEffectsOrder,
} from "../../src/app/lib/sound-effects-client.js";

function createWindowMock() {
  const eventTarget = new EventTarget();
  const store = new Map();

  return {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
    addEventListener(type, listener) {
      eventTarget.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      eventTarget.removeEventListener(type, listener);
    },
    dispatchEvent(event) {
      return eventTarget.dispatchEvent(event);
    },
  };
}

test("[match] sound effect search matches label, filename, and id case-insensitively", () => {
  const files = [
    {
      id: "crowd-cheer.mp3",
      fileName: "Crowd Cheer.mp3",
      label: "Crowd Cheer",
    },
    {
      id: "ipl_theme_song.mp3",
      fileName: "ipl_theme_song.mp3",
      label: "IPL theme song",
    },
  ];

  assert.deepEqual(
    filterSoundEffectsByQuery(files, "theme").map((file) => file.id),
    ["ipl_theme_song.mp3"],
  );
  assert.deepEqual(
    filterSoundEffectsByQuery(files, "crowd cheer").map((file) => file.id),
    ["crowd-cheer.mp3"],
  );
  assert.deepEqual(
    filterSoundEffectsByQuery(files, "ipl_theme").map((file) => file.id),
    ["ipl_theme_song.mp3"],
  );
});

test("[match] sound effect cache sync notifies listeners when the shared library changes", () => {
  const previousWindow = global.window;
  global.window = createWindowMock();

  try {
    let syncCount = 0;
    const unsubscribe = subscribeSoundEffectsLibrarySync(() => {
      syncCount += 1;
    });

    writeCachedSoundEffectsLibrary([
      {
        id: "crowd-cheer.mp3",
        fileName: "Crowd Cheer.mp3",
        label: "Crowd Cheer",
        src: "/audio/effects/Crowd%20Cheer.mp3",
      },
    ]);
    writeCachedSoundEffectsOrder(["crowd-cheer.mp3"]);
    unsubscribe();

    assert.equal(syncCount >= 2, true);
  } finally {
    global.window = previousWindow;
  }
});
