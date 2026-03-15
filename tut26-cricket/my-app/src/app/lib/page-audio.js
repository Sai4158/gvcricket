let sharedUiAudioContext = null;
let sharedUiAudioUnlocked = false;

const unlockListeners = new Set();
const cachedAudioUrlMap = new Map();
const cachedAudioRequestMap = new Map();

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

  if (cachedAudioUrlMap.has(safeSrc)) {
    return cachedAudioUrlMap.get(safeSrc);
  }

  if (cachedAudioRequestMap.has(safeSrc)) {
    return cachedAudioRequestMap.get(safeSrc);
  }

  const request = fetch(safeSrc, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Audio file could not be fetched.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      cachedAudioUrlMap.set(safeSrc, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      cachedAudioRequestMap.delete(safeSrc);
    });

  cachedAudioRequestMap.set(safeSrc, request);
  return request;
}

export async function preloadCachedAudioAssets(sources = []) {
  const uniqueSources = [...new Set((sources || []).filter(Boolean))];
  await Promise.allSettled(
    uniqueSources.map((source) => getCachedAudioAssetUrl(source))
  );
}

export function duckPageMedia(stateRef, duckVolume = 0.18) {
  if (typeof document === "undefined" || !stateRef) {
    return;
  }

  if (Array.isArray(stateRef.current) && stateRef.current.length > 0) {
    return;
  }

  const tracked = [];
  const mediaElements = document.querySelectorAll("audio, video");

  mediaElements.forEach((element) => {
    try {
      tracked.push({
        element,
        volume: typeof element.volume === "number" ? element.volume : 1,
        muted: Boolean(element.muted),
      });

      if (!element.muted) {
        element.volume = Math.min(element.volume, duckVolume);
      }
    } catch {
      // Ignore media elements the browser refuses to adjust.
    }
  });

  stateRef.current = tracked;
}

export function restorePageMedia(stateRef) {
  if (!stateRef || !Array.isArray(stateRef.current)) {
    return;
  }

  for (const item of stateRef.current) {
    try {
      item.element.muted = item.muted;
      item.element.volume = item.volume;
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
  if (typeof window === "undefined") {
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
