"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

const SETTINGS_VERSION = 9;

const DEFAULTS = {
  spectator: {
    version: SETTINGS_VERSION,
    enabled: true,
    muted: false,
    volume: 0.85,
    mode: "full",
    accessibilityMode: false,
    playScoreSoundEffects: true,
    broadcastScoreSoundEffects: true,
    scoreSoundEffectMap: {
      out: "",
      two: "",
      three: "",
      four: "",
      six: "",
    },
  },
  umpire: {
    version: SETTINGS_VERSION,
    enabled: true,
    muted: false,
    volume: 0.75,
    mode: "simple",
    accessibilityMode: false,
    playScoreSoundEffects: true,
    broadcastScoreSoundEffects: true,
    scoreSoundEffectMap: {
      out: "",
      two: "",
      three: "",
      four: "",
      six: "ipl_theme_song.mp3",
    },
  },
};

function mergeSettings(role, parsed = {}) {
  const base = DEFAULTS[role] || {};
  const parsedMap =
    parsed?.scoreSoundEffectMap && typeof parsed.scoreSoundEffectMap === "object"
      ? parsed.scoreSoundEffectMap
      : {};

  return {
    ...base,
    ...parsed,
    scoreSoundEffectMap: {
      ...(base.scoreSoundEffectMap || {}),
      ...parsedMap,
    },
  };
}

function getStorageKey(role) {
  return `gv-announcer-${role}`;
}

function getEnabledStorageKey(role, scopeKey = "") {
  return `gv-announcer-enabled-${role}${scopeKey ? `-${scopeKey}` : ""}`;
}

function readRawValue(role) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(getStorageKey(role)) || "";
  } catch (error) {
    console.error("Failed to read announcer settings:", error);
    return "";
  }
}

function readEnabledValue(role, scopeKey) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.sessionStorage.getItem(getEnabledStorageKey(role, scopeKey)) || "";
  } catch (error) {
    console.error("Failed to read announcer enabled state:", error);
    return "";
  }
}

function persistSettings(role, settings) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(role), JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to persist announcer settings:", error);
  }
}

export default function useAnnouncementSettings(role, scopeKey = "") {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const subscribe = useMemo(
    () => (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleStorage = (event) => {
        if (
          !event.key ||
          event.key === getStorageKey(role) ||
          event.key === getEnabledStorageKey(role, scopeKey)
        ) {
          onStoreChange();
        }
      };

      const handleCustom = (event) => {
        if (
          event.detail?.role === role &&
          event.detail?.scopeKey === scopeKey
        ) {
          onStoreChange();
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("gv-announcer-change", handleCustom);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("gv-announcer-change", handleCustom);
      };
    },
    [role, scopeKey]
  );

  const rawValue = useSyncExternalStore(
    subscribe,
    () => (hydrated ? readRawValue(role) : ""),
    () => ""
  );
  const enabledValue = useSyncExternalStore(
    subscribe,
    () => (hydrated ? readEnabledValue(role, scopeKey) : ""),
    () => ""
  );

  const persistedSettings = useMemo(() => {
    try {
      if (!rawValue) {
        return DEFAULTS[role];
      }

      const parsed = JSON.parse(rawValue);
      const isLegacyVersion =
        !parsed?.version || Number(parsed.version) < SETTINGS_VERSION;

      return {
        ...mergeSettings(role, parsed),
        ...(role === "umpire" && isLegacyVersion
          ? {
              enabled: true,
              playScoreSoundEffects: true,
              broadcastScoreSoundEffects: true,
            }
          : {}),
        version: SETTINGS_VERSION,
      };
    } catch (error) {
      console.error("Failed to load announcer settings:", error);
      return DEFAULTS[role];
    }
  }, [rawValue, role]);

  const enabled = useMemo(() => {
    if (!enabledValue) {
      return true;
    }

    return enabledValue === "true";
  }, [enabledValue]);

  const settings = useMemo(
    () => ({
      ...persistedSettings,
      enabled,
    }),
    [persistedSettings, enabled]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed.version || parsed.version < SETTINGS_VERSION) {
        persistSettings(role, settings);
      }
    } catch {
      persistSettings(role, settings);
    }
  }, [rawValue, role, settings]);

  const updateSetting = (key, value) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (key === "enabled") {
        window.sessionStorage.setItem(
          getEnabledStorageKey(role, scopeKey),
          value ? "true" : "false"
        );
        window.dispatchEvent(
          new CustomEvent("gv-announcer-change", {
            detail: { role, scopeKey },
          })
        );
        return;
      }

      const nextSettings = {
        ...persistedSettings,
        [key]: value,
      };
      persistSettings(role, nextSettings);
      window.dispatchEvent(
        new CustomEvent("gv-announcer-change", {
          detail: { role, scopeKey },
        })
      );
    } catch (error) {
      console.error("Failed to save announcer settings:", error);
    }
  };

  return {
    settings,
    updateSetting,
  };
}
