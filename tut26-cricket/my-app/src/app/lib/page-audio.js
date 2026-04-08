/**
 * File overview:
 * Purpose: Shared helper module for Page Audio logic.
 * Main exports: isIOSSafari, isUiAudioUnlocked, subscribeUiAudioUnlock, getPreferredAudioSessionType, setPreferredAudioSessionType, setPlaybackFriendlyAudioSessionType, restorePreferredAudioSessionType, duckPageMedia, restorePageMedia, playUiTone.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: performs network requests.
 * Read next: README.md
 */
let sharedUiAudioContext = null;
let sharedUiAudioUnlocked = false;

const unlockListeners = new Set();
const cachedAudioUrlMap = new Map();
const cachedAudioRequestMap = new Map();
const cachedAudioBufferMap = new Map();
const cachedAudioBufferRequestMap = new Map();
const UI_AUDIO_CACHE_NAME = "gv-ui-audio-assets-v1";
const SUPPORTED_AUDIO_SESSION_TYPES = new Set([
  "auto",
  "ambient",
  "playback",
  "play-and-record",
  "transient",
  "transient-solo",
]);

const SILENT_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

function notifyUiAudioUnlock(nextValue) {
  if (sharedUiAudioUnlocked === nextValue) {
    return;
  }

  sharedUiAudioUnlocked = nextValue;
  for (const listener of unlockListeners) {
    try {
      listener(sharedUiAudioUnlocked);
    } catch {
      // Ignore listener failures and keep unlock state flowing.
    }
  }
}

export function isIOSSafari() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator?.userAgent || "";
  const vendor = window.navigator?.vendor || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator?.platform === "MacIntel" &&
      window.navigator?.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) &&
    /Apple/i.test(vendor);

  return isIOS && isSafari;
}

export function isUiAudioUnlocked() {
  return sharedUiAudioUnlocked;
}

export function subscribeUiAudioUnlock(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

function getUiAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!sharedUiAudioContext || sharedUiAudioContext.state === "closed") {
    sharedUiAudioContext = new AudioContextClass({
      latencyHint: "interactive",
    });
  }

  return sharedUiAudioContext;
}

function getNavigatorAudioSession() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const session = navigator.audioSession;
  if (!session || typeof session.type !== "string") {
    return null;
  }

  return session;
}

async function warmAudioContext(context) {
  if (!context) {
    return false;
  }

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    const gain = context.createGain();
    gain.gain.value = 0.0001;
    gain.connect(context.destination);

    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, 22050);
    source.connect(gain);
    source.start(0);
    source.stop(context.currentTime + 0.01);

    return context.state === "running";
  } catch {
    return false;
  }
}

async function warmMediaElement(element) {
  if (
    !element ||
    typeof element.play !== "function" ||
    typeof element.pause !== "function"
  ) {
    return false;
  }

  if (!element.paused && !element.ended) {
    return true;
  }

  const snapshot = {
    src: element.getAttribute("src") || "",
    preload: element.preload || "",
    muted: Boolean(element.muted),
    volume: typeof element.volume === "number" ? element.volume : 1,
    currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
    autoplay: Boolean(element.autoplay),
  };

  try {
    element.autoplay = false;
    element.muted = true;
    element.volume = 0;
    element.preload = "auto";
    element.playsInline = true;
    element.setAttribute("playsinline", "");
    element.setAttribute("webkit-playsinline", "");

    if (!snapshot.src) {
      element.src = SILENT_AUDIO_DATA_URI;
      element.load();
    }

    const playPromise = element.play();
    if (playPromise && typeof playPromise.then === "function") {
      await playPromise;
    }
    element.pause();
    element.currentTime = 0;

    if (!snapshot.src) {
      element.removeAttribute("src");
      element.load();
    } else {
      element.currentTime = snapshot.currentTime;
    }

    element.muted = snapshot.muted;
    element.volume = snapshot.volume;
    element.preload = snapshot.preload;
    element.autoplay = snapshot.autoplay;
    return true;
  } catch {
    try {
      if (!snapshot.src) {
        element.removeAttribute("src");
        element.load();
      }
      element.muted = snapshot.muted;
      element.volume = snapshot.volume;
      element.preload = snapshot.preload;
      element.autoplay = snapshot.autoplay;
    } catch {
      // Ignore rollback failures on stubborn Safari media elements.
    }
    return false;
  }
}

export async function primeUiAudio(options = {}) {
  const context = getUiAudioContext();
  const mediaElements = Array.isArray(options.mediaElements)
    ? options.mediaElements.filter(Boolean)
    : [];

  const contextReady = await warmAudioContext(context);
  let mediaReady = false;

  for (const element of mediaElements) {
    // Keep this sequential so iOS Safari treats it as one user-gesture flow.
    mediaReady = (await warmMediaElement(element)) || mediaReady;
  }

  const unlocked = Boolean(contextReady || mediaReady);
  if (unlocked) {
    notifyUiAudioUnlock(true);
  }

  return unlocked;
}

function normalizeCachedAudioSource(src) {
  const safeSrc = String(src || "");
  if (!safeSrc) {
    return "";
  }

  if (safeSrc.startsWith("blob:") || safeSrc.startsWith("data:")) {
    return safeSrc;
  }

  if (typeof window === "undefined") {
    return safeSrc;
  }

  try {
    return new URL(safeSrc, window.location.href).toString();
  } catch {
    return safeSrc;
  }
}

export async function getCachedAudioAssetUrl(src) {
  const safeSrc = String(src || "");
  if (!safeSrc) {
    return "";
  }

  if (
    safeSrc.startsWith("blob:") ||
    safeSrc.startsWith("data:")
  ) {
    return safeSrc;
  }

  const cacheKey = normalizeCachedAudioSource(safeSrc);

  if (cachedAudioUrlMap.has(cacheKey)) {
    return cachedAudioUrlMap.get(cacheKey);
  }

  if (cachedAudioRequestMap.has(cacheKey)) {
    return cachedAudioRequestMap.get(cacheKey);
  }

  const request = (async () => {
    if (
      typeof window !== "undefined" &&
      "caches" in window &&
      /^https?:/i.test(window.location?.protocol || "http:")
    ) {
      try {
        const cache = await window.caches.open(UI_AUDIO_CACHE_NAME);
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse?.ok) {
          const cachedBlob = await cachedResponse.blob();
          const cachedObjectUrl = URL.createObjectURL(cachedBlob);
          cachedAudioUrlMap.set(cacheKey, cachedObjectUrl);
          return cachedObjectUrl;
        }
      } catch {
        // Fall back to direct fetch if Cache Storage is unavailable or blocked.
      }
    }

    const response = await fetch(cacheKey, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error("Audio file could not be fetched.");
    }

    try {
      if (
        typeof window !== "undefined" &&
        "caches" in window &&
        /^https?:/i.test(window.location?.protocol || "http:")
      ) {
        const cache = await window.caches.open(UI_AUDIO_CACHE_NAME);
        await cache.put(cacheKey, response.clone());
      }
    } catch {
      // Ignore Cache Storage failures and continue with in-memory caching.
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    cachedAudioUrlMap.set(cacheKey, objectUrl);
    return objectUrl;
  })()
    .finally(() => {
      cachedAudioRequestMap.delete(cacheKey);
    });

  cachedAudioRequestMap.set(cacheKey, request);
  return request;
}

async function getCachedAudioArrayBuffer(src) {
  const safeSrc = String(src || "");
  if (!safeSrc) {
    return null;
  }

  const cacheKey = normalizeCachedAudioSource(safeSrc);

  if (
    typeof window !== "undefined" &&
    "caches" in window &&
    /^https?:/i.test(window.location?.protocol || "http:")
  ) {
    try {
      const cache = await window.caches.open(UI_AUDIO_CACHE_NAME);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse?.ok) {
        return await cachedResponse.arrayBuffer();
      }
    } catch {
      // Fall back to direct fetch.
    }
  }

  const response = await fetch(cacheKey, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Audio file could not be fetched.");
  }

  try {
    if (
      typeof window !== "undefined" &&
      "caches" in window &&
      /^https?:/i.test(window.location?.protocol || "http:")
    ) {
      const cache = await window.caches.open(UI_AUDIO_CACHE_NAME);
      await cache.put(cacheKey, response.clone());
    }
  } catch {
    // Ignore Cache Storage failures and continue.
  }

  return await response.arrayBuffer();
}

async function getCachedAudioBuffer(src) {
  const safeSrc = String(src || "");
  if (!safeSrc) {
    return null;
  }

  const cacheKey = normalizeCachedAudioSource(safeSrc);

  if (cachedAudioBufferMap.has(cacheKey)) {
    return cachedAudioBufferMap.get(cacheKey);
  }

  if (cachedAudioBufferRequestMap.has(cacheKey)) {
    return cachedAudioBufferRequestMap.get(cacheKey);
  }

  const request = (async () => {
    const context = getUiAudioContext();
    if (!context) {
      throw new Error("Web Audio is unavailable.");
    }

    const arrayBuffer = await getCachedAudioArrayBuffer(cacheKey);
    if (!arrayBuffer) {
      throw new Error("Audio buffer could not be loaded.");
    }

    const decodedBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    cachedAudioBufferMap.set(cacheKey, decodedBuffer);
    return decodedBuffer;
  })().finally(() => {
    cachedAudioBufferRequestMap.delete(cacheKey);
  });

  cachedAudioBufferRequestMap.set(cacheKey, request);
  return request;
}

export async function playBufferedUiAudio(
  src,
  { volume = 1, onEnded = null } = {}
) {
  const context = getUiAudioContext();
  if (!context) {
    return null;
  }

  const ready = await warmAudioContext(context);
  if (!ready && context.state !== "running") {
    return null;
  }

  const buffer = await getCachedAudioBuffer(src);
  if (!buffer) {
    return null;
  }

  const source = context.createBufferSource();
  const gainNode = context.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1, volume));
  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(context.destination);

  const startTime = context.currentTime;
  let stopped = false;

  const cleanup = () => {
    try {
      source.disconnect();
    } catch {}
    try {
      gainNode.disconnect();
    } catch {}
  };

  source.onended = () => {
    cleanup();
    if (stopped) {
      return;
    }
    if (typeof onEnded === "function") {
      onEnded();
    }
  };

  source.start(0);

  return {
    duration: buffer.duration,
    startedAt: startTime,
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      try {
        source.stop(0);
      } catch {
        cleanup();
      }
    },
    getCurrentTime() {
      if (stopped) {
        return 0;
      }
      return Math.max(0, context.currentTime - startTime);
    },
  };
}

export function getPreferredAudioSessionType() {
  const session = getNavigatorAudioSession();
  return session?.type || "";
}

function hasActivePageMediaPlayback() {
  if (typeof document === "undefined") {
    return false;
  }

  const mediaElements = document.querySelectorAll("audio, video");
  for (const element of mediaElements) {
    try {
      if (
        !element.paused &&
        !element.ended &&
        Number(element.readyState || 0) >= 2 &&
        !element.muted &&
        Number(element.volume || 0) > 0
      ) {
        return true;
      }
    } catch {
      // Ignore stale or inaccessible media elements.
    }
  }

  return false;
}

export function setPreferredAudioSessionType(nextType) {
  const session = getNavigatorAudioSession();
  if (!session || !SUPPORTED_AUDIO_SESSION_TYPES.has(nextType)) {
    return "";
  }

  const previousType = session.type || "auto";
  if (previousType === nextType) {
    return previousType;
  }

  try {
    session.type = nextType;
  } catch {
    return previousType;
  }

  return previousType;
}

export function setPlaybackFriendlyAudioSessionType({
  preferMixing = true,
} = {}) {
  const nextType =
    preferMixing && hasActivePageMediaPlayback() ? "ambient" : "playback";
  return setPreferredAudioSessionType(nextType);
}

export function restorePreferredAudioSessionType(previousType) {
  const session = getNavigatorAudioSession();
  if (!session || !SUPPORTED_AUDIO_SESSION_TYPES.has(previousType)) {
    return false;
  }

  try {
    if (session.type !== previousType) {
      session.type = previousType;
    }
    return true;
  } catch {
    return false;
  }
}

export async function preloadCachedAudioAssets(sources = []) {
  const uniqueSources = [...new Set((sources || []).filter(Boolean))];
  await Promise.allSettled(
    uniqueSources.map((source) => getCachedAudioAssetUrl(source))
  );
}

function clearTrackedMediaResumeState(item) {
  if (!item) {
    return;
  }

  if (Array.isArray(item.resumeTimerIds)) {
    for (const timerId of item.resumeTimerIds) {
      window.clearTimeout(timerId);
    }
  }
  item.resumeTimerIds = [];

  if (item.pauseListener && item.element?.removeEventListener) {
    try {
      item.element.removeEventListener("pause", item.pauseListener);
    } catch {
      // Ignore stale media listeners during cleanup.
    }
  }
  item.pauseListener = null;
}

function resumeTrackedMediaItem(
  item,
  retryDelaysMs = [0, 140, 420],
  { keepAlive = false, ignoreRestored = false } = {},
) {
  if (!item?.wasPlaying || !item?.element || typeof window === "undefined") {
    return;
  }

  const mediaElement = item.element;
  const retryDelays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs
    : [0, 140, 420];

  const attemptResume = () => {
    try {
      if (item.restored && !ignoreRestored) {
        return;
      }

      if (!mediaElement.paused || mediaElement.ended) {
        return;
      }

      const resumePromise = mediaElement.play?.();
      if (resumePromise && typeof resumePromise.catch === "function") {
        resumePromise.catch(() => {});
      }
    } catch {
      // Ignore resume failures and let the next retry try again.
    }
  };

  if (!keepAlive) {
    clearTrackedMediaResumeState(item);
  }

  for (const delayMs of retryDelays) {
    if (delayMs <= 0) {
      attemptResume();
      continue;
    }

    const timerId = window.setTimeout(attemptResume, delayMs);
    if (!Array.isArray(item.resumeTimerIds)) {
      item.resumeTimerIds = [];
    }
    item.resumeTimerIds.push(timerId);
  }
}

export function duckPageMedia(stateRef, duckVolume = 0.18, options = {}) {
  if (typeof document === "undefined" || !stateRef) {
    return false;
  }

  if (Array.isArray(stateRef.current) && stateRef.current.length > 0) {
    return true;
  }

  const excludedElements = new Set(
    Array.isArray(options.excludedElements) ? options.excludedElements : [],
  );
  const tracked = [];
  const mediaElements = document.querySelectorAll("audio, video");

  mediaElements.forEach((element) => {
    if (excludedElements.has(element)) {
      return;
    }

    try {
      const wasPlaying = Boolean(
        !element.paused &&
          !element.ended &&
          Number(element.readyState || 0) >= 2,
      );
      tracked.push({
        element,
        volume: typeof element.volume === "number" ? element.volume : 1,
        muted: Boolean(element.muted),
        wasPlaying,
        restored: false,
        pauseListener: null,
        resumeTimerIds: [],
      });

      if (!element.muted) {
        element.volume = Math.min(element.volume, duckVolume);
      }
    } catch {
      // Ignore media elements the browser refuses to adjust.
    }
  });

  for (const item of tracked) {
    if (!item?.wasPlaying || !item.element?.addEventListener) {
      continue;
    }

    const handlePauseDuringDuck = () => {
      resumeTrackedMediaItem(item, [24, 120, 320], { keepAlive: true });
    };

    item.pauseListener = handlePauseDuringDuck;

    try {
      item.element.addEventListener("pause", handlePauseDuringDuck);
    } catch {
      item.pauseListener = null;
    }
  }

  stateRef.current = tracked;
  return tracked.length > 0;
}

export function restorePageMedia(stateRef) {
  if (!stateRef || !Array.isArray(stateRef.current)) {
    return;
  }

  for (const item of stateRef.current) {
    try {
      item.restored = true;
      clearTrackedMediaResumeState(item);
      item.element.muted = item.muted;
      item.element.volume = item.volume;
      resumeTrackedMediaItem(item, [0, 140, 420], { ignoreRestored: true });
    } catch {
      // Ignore stale media elements removed from the page.
    }
  }

  stateRef.current = [];
}

export function playUiTone({
  frequency = 880,
  durationMs = 180,
  type = "sine",
  volume = 0.04,
} = {}) {
  if (typeof window === "undefined" || !sharedUiAudioUnlocked) {
    return;
  }

  try {
    const audioContext = getUiAudioContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);
  } catch {
    // Best-effort only.
  }
}
