"use client";

const SOUND_EFFECT_LIBRARY_CACHE_KEY = "gv-director-audio-library-v1";
const SOUND_EFFECT_ORDER_STORAGE_KEY = "gv-director-audio-order:global";
const SOUND_EFFECT_LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000;

let soundEffectsLibraryMemoryCache = null;
let soundEffectsLibraryPromise = null;

function normalizeOrder(order) {
  return Array.isArray(order)
    ? order.filter((value) => typeof value === "string" && value.trim())
    : [];
}

export function sortSoundEffectsByOrder(files, order = []) {
  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  const normalizedOrder = normalizeOrder(order);
  if (!normalizedOrder.length) {
    return [...files];
  }

  const orderMap = new Map(normalizedOrder.map((id, index) => [id, index]));
  return [...files].sort((left, right) => {
    const leftIndex = orderMap.has(left.id)
      ? orderMap.get(left.id)
      : Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.has(right.id)
      ? orderMap.get(right.id)
      : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return String(left?.label || "").localeCompare(String(right?.label || ""));
  });
}

export function readCachedSoundEffectsOrder() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(SOUND_EFFECT_ORDER_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    return normalizeOrder(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function writeCachedSoundEffectsOrder(order) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SOUND_EFFECT_ORDER_STORAGE_KEY,
      JSON.stringify(normalizeOrder(order)),
    );
  } catch {
    // Ignore storage failures and keep the in-memory order flow.
  }
}

export async function persistSoundEffectsOrder(order, { keepalive = false } = {}) {
  const nextOrder = normalizeOrder(order);
  if (!nextOrder.length) {
    return false;
  }

  try {
    const response = await fetch("/api/director/audio-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive,
      body: JSON.stringify({ order: nextOrder }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export function readCachedSoundEffectsLibrary() {
  if (Array.isArray(soundEffectsLibraryMemoryCache) && soundEffectsLibraryMemoryCache.length) {
    return soundEffectsLibraryMemoryCache;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.localStorage.getItem(
      SOUND_EFFECT_LIBRARY_CACHE_KEY,
    );
    if (!cachedValue) {
      return [];
    }

    const parsed = JSON.parse(cachedValue);
    const savedAt = Number(parsed?.savedAt || 0);
    const files = Array.isArray(parsed?.files) ? parsed.files : [];

    if (!files.length) {
      return [];
    }

    if (savedAt && Date.now() - savedAt > SOUND_EFFECT_LIBRARY_CACHE_TTL_MS) {
      return [];
    }

    soundEffectsLibraryMemoryCache = files;
    return files;
  } catch {
    return [];
  }
}

export function writeCachedSoundEffectsLibrary(files) {
  if (!Array.isArray(files)) {
    return;
  }

  soundEffectsLibraryMemoryCache = files;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SOUND_EFFECT_LIBRARY_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        files,
      }),
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

export async function fetchCachedSoundEffectsLibrary({ force = false } = {}) {
  if (!force) {
    const cachedFiles = readCachedSoundEffectsLibrary();
    if (cachedFiles.length) {
      return sortSoundEffectsByOrder(cachedFiles, readCachedSoundEffectsOrder());
    }
  }

  if (soundEffectsLibraryPromise) {
    return soundEffectsLibraryPromise;
  }

  soundEffectsLibraryPromise = (async () => {
    const response = await fetch("/api/director/audio-library", {
      cache: "no-store",
    });
    const payload = await response
      .json()
      .catch(() => ({ files: [] }));

    if (!response.ok) {
      throw new Error(payload?.message || "Could not load sound effects.");
    }

    const nextFiles = Array.isArray(payload?.files) ? payload.files : [];
    const nextOrder = normalizeOrder(payload?.order);
    if (nextOrder.length) {
      writeCachedSoundEffectsOrder(nextOrder);
    }
    const sortedFiles = sortSoundEffectsByOrder(
      nextFiles,
      nextOrder.length ? nextOrder : readCachedSoundEffectsOrder(),
    );
    writeCachedSoundEffectsLibrary(sortedFiles);
    return sortedFiles;
  })().finally(() => {
    soundEffectsLibraryPromise = null;
  });

  return soundEffectsLibraryPromise;
}
