import assert from "node:assert/strict";
import test from "node:test";

import {
  duckPageMedia,
  restorePageMedia,
  restorePreferredAudioSessionType,
  setPlaybackFriendlyAudioSessionType,
} from "../src/app/lib/page-audio.js";

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
      return;
    }

    delete globalThis[name];
  };
}

function createMediaElement({
  tagName = "AUDIO",
  src = "/audio/test.mp3",
  paused = false,
  ended = false,
  readyState = 4,
  muted = false,
  volume = 1,
  currentTime = 0,
} = {}) {
  const listeners = new Map();

  return {
    tagName,
    src,
    currentSrc: src,
    paused,
    ended,
    readyState,
    muted,
    volume,
    currentTime,
    dataset: {},
    playCallCount: 0,
    pauseCallCount: 0,
    play() {
      this.playCallCount += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCallCount += 1;
      this.paused = true;
    },
    addEventListener(type, listener) {
      const listenersForType = listeners.get(type) || new Set();
      listenersForType.add(listener);
      listeners.set(type, listenersForType);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(type) {
      for (const listener of listeners.get(type) || []) {
        listener();
      }
    },
    getAttribute(name) {
      if (name === "src") {
        return this.src;
      }

      return "";
    },
    setAttribute() {},
    removeAttribute() {},
    load() {},
  };
}

async function withPageAudioGlobals(
  { elements = [], audioSessionType = "auto" } = {},
  run,
) {
  const audioSession = { type: audioSessionType };
  const windowMock = {
    setTimeout,
    clearTimeout,
    navigator: {
      userAgent: "",
      vendor: "",
      audioSession,
    },
    location: {
      href: "http://127.0.0.1/test",
      protocol: "http:",
    },
  };
  const restoreWindow = replaceGlobal("window", windowMock);
  const restoreDocument = replaceGlobal("document", {
    querySelectorAll(selector) {
      assert.equal(selector, "audio, video");
      return elements;
    },
  });
  const restoreNavigator = replaceGlobal("navigator", windowMock.navigator);
  const previousInfo = console.info;
  const previousWarn = console.warn;
  const previousError = console.error;

  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    await run(audioSession);
  } finally {
    console.info = previousInfo;
    console.warn = previousWarn;
    console.error = previousError;
    restoreNavigator();
    restoreDocument();
    restoreWindow();
  }
}

test("spoken-announcement ducking lowers only currently playing page media and restores it exactly", async () => {
  const playingMusic = createMediaElement({
    src: "/audio/music-bed.mp3",
    paused: false,
    volume: 0.72,
    currentTime: 53.4,
  });
  const pausedClip = createMediaElement({
    src: "/audio/paused-intro.mp3",
    paused: true,
    volume: 0.61,
    currentTime: 8.2,
  });
  const stateRef = { current: [] };

  await withPageAudioGlobals(
    {
      elements: [playingMusic, pausedClip],
    },
    async () => {
      assert.equal(
        duckPageMedia(stateRef, 0.12, { debugLabel: "umpire-announcement" }),
        true,
      );
      assert.equal(playingMusic.volume, 0.12);
      assert.equal(playingMusic.muted, false);
      assert.equal(playingMusic.paused, false);
      assert.equal(playingMusic.currentTime, 53.4);
      assert.equal(pausedClip.volume, 0.61);
      assert.equal(pausedClip.paused, true);

      restorePageMedia(stateRef);
      await new Promise((resolve) => setTimeout(resolve, 5));

      assert.equal(playingMusic.volume, 0.72);
      assert.equal(playingMusic.muted, false);
      assert.equal(playingMusic.paused, false);
      assert.equal(playingMusic.currentTime, 53.4);
      assert.equal(pausedClip.volume, 0.61);
      assert.equal(pausedClip.paused, true);
    },
  );
});

test("sound-effect ducking re-resumes media that gets paused while ducked", async () => {
  const playingMusic = createMediaElement({
    src: "/audio/music-bed.mp3",
    paused: false,
    volume: 0.8,
    currentTime: 21.5,
  });
  const stateRef = { current: [] };

  await withPageAudioGlobals(
    {
      elements: [playingMusic],
    },
    async () => {
      duckPageMedia(stateRef, 0.18, { debugLabel: "umpire-announcement" });
      playingMusic.paused = true;
      playingMusic.dispatchEvent("pause");

      await new Promise((resolve) => setTimeout(resolve, 40));

      assert.equal(playingMusic.playCallCount >= 1, true);
      assert.equal(playingMusic.paused, false);

      restorePageMedia(stateRef);
      await new Promise((resolve) => setTimeout(resolve, 5));

      assert.equal(playingMusic.volume, 0.8);
      assert.equal(playingMusic.paused, false);
    },
  );
});

test("mixing-friendly audio session selects ambient when page media is already playing and restores afterward", async () => {
  const playingMusic = createMediaElement({
    src: "/audio/music-bed.mp3",
    paused: false,
    volume: 0.55,
  });

  await withPageAudioGlobals(
    {
      elements: [playingMusic],
      audioSessionType: "auto",
    },
    async (audioSession) => {
      const previousType = setPlaybackFriendlyAudioSessionType({
        preferMixing: true,
        debugLabel: "speech",
      });

      assert.equal(previousType, "auto");
      assert.equal(audioSession.type, "ambient");
      assert.equal(
        restorePreferredAudioSessionType(previousType, {
          debugLabel: "speech",
        }),
        true,
      );
      assert.equal(audioSession.type, "auto");
    },
  );
});

test("repeated rapid duck cycles do not stop already playing page music", async () => {
  const playingMusic = createMediaElement({
    src: "/audio/music-bed.mp3",
    paused: false,
    volume: 0.67,
    currentTime: 14.25,
  });
  const stateRef = { current: [] };

  await withPageAudioGlobals(
    {
      elements: [playingMusic],
    },
    async () => {
      for (let index = 0; index < 4; index += 1) {
        duckPageMedia(stateRef, 0.12, { debugLabel: "umpire-announcement" });
        restorePageMedia(stateRef);
      }

      await new Promise((resolve) => setTimeout(resolve, 5));

      assert.equal(playingMusic.pauseCallCount, 0);
      assert.equal(playingMusic.playCallCount, 0);
      assert.equal(playingMusic.paused, false);
      assert.equal(playingMusic.volume, 0.67);
      assert.equal(playingMusic.currentTime, 14.25);
    },
  );
});
