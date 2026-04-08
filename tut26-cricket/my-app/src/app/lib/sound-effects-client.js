"use client";


/**
 * File overview:
 * Purpose: Shared helper module for Sound Effects Client logic.
 * Main exports: filterSoundEffectsByQuery, sortSoundEffectsByOrder, readCachedSoundEffectsOrder, writeCachedSoundEffectsOrder, readCachedSoundEffectsLibrary, writeCachedSoundEffectsLibrary, clearCachedSoundEffectsLibrary, subscribeSoundEffectsLibrarySync, SOUND_EFFECT_LIBRARY_CACHE_KEY, SOUND_EFFECT_ORDER_STORAGE_KEY.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: reads or writes browser storage.
 * Read next: README.md
 */
import { preloadCachedAudioAssets } from "./page-audio";

export const SOUND_EFFECT_LIBRARY_CACHE_KEY = "gv-director-audio-library-v1";
export const SOUND_EFFECT_ORDER_STORAGE_KEY = "gv-director-audio-order:global";
const SOUND_EFFECT_LIBRARY_SYNC_EVENT = "gv:sound-effects-library-sync";
const SOUND_EFFECT_LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_SOUND_EFFECT_PRELOAD_LIMIT = 12;

let soundEffectsLibraryMemoryCache = null;
let soundEffectsLibraryPromise = null;

function emitSoundEffectsLibrarySync() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SOUND_EFFECT_LIBRARY_SYNC_EVENT));
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeOrder(order) {
  return Array.isArray(order)
    ? order.filter((value) => typeof value === "string" && value.trim())
    : [];
}

export function filterSoundEffectsByQuery(files, query = "") {
  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...files];
  }

  return files.filter((file) => {
    const searchHaystack = normalizeSearchText(
      `${file?.label || ""} ${file?.fileName || ""} ${file?.id || ""}`,
    );
    return searchHaystack.includes(normalizedQuery);
  });
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
    emitSoundEffectsLibrarySync();
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
    emitSoundEffectsLibrarySync();
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
      cache: force ? "no-store" : "default",
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

export async function warmCachedSoundEffectAssets(
  files,
  { preferredIds = [], limit = DEFAULT_SOUND_EFFECT_PRELOAD_LIMIT } = {},
) {
  if (!Array.isArray(files) || !files.length) {
    return;
  }

  const preferredSet = new Set(
    Array.isArray(preferredIds)
      ? preferredIds
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [],
  );

  const preferredFiles = [];
  const remainingFiles = [];

  for (const file of files) {
    if (!file?.src) {
      continue;
    }

    if (preferredSet.has(String(file.id || "").trim())) {
      preferredFiles.push(file);
    } else {
      remainingFiles.push(file);
    }
  }

  const prioritizedSources = [...preferredFiles, ...remainingFiles]
    .slice(0, Math.max(1, Number(limit) || DEFAULT_SOUND_EFFECT_PRELOAD_LIMIT))
    .map((file) => file?.src)
    .filter(Boolean);

  if (!prioritizedSources.length) {
    return;
  }

  await preloadCachedAudioAssets(prioritizedSources);
}

export function clearCachedSoundEffectsLibrary() {
  soundEffectsLibraryMemoryCache = null;
  soundEffectsLibraryPromise = null;
}

export function subscribeSoundEffectsLibrarySync(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") {
    return () => {};
  }

  const handleSync = () => {
    listener();
  };

  const handleStorage = (event) => {
    if (
      event?.key &&
      event.key !== SOUND_EFFECT_LIBRARY_CACHE_KEY &&
      event.key !== SOUND_EFFECT_ORDER_STORAGE_KEY
    ) {
      return;
    }

    listener();
  };

  window.addEventListener(SOUND_EFFECT_LIBRARY_SYNC_EVENT, handleSync);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SOUND_EFFECT_LIBRARY_SYNC_EVENT, handleSync);
    window.removeEventListener("storage", handleStorage);
  };
}
