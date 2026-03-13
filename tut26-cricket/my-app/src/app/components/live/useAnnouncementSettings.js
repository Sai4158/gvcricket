"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

const SETTINGS_VERSION = 4;

const DEFAULTS = {
  spectator: {
    version: SETTINGS_VERSION,
    enabled: false,
    muted: false,
    volume: 0.85,
    mode: "full",
    accessibilityMode: false,
  },
  umpire: {
    version: SETTINGS_VERSION,
    enabled: true,
    muted: false,
    volume: 0.75,
    mode: "simple",
    accessibilityMode: false,
  },
};

function getStorageKey(role) {
  return `gv-announcer-${role}`;
}

function readRawValue(role) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(getStorageKey(role)) || "";
}

export default function useAnnouncementSettings(role) {
  const subscribe = useMemo(
    () => (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleStorage = (event) => {
        if (!event.key || event.key === getStorageKey(role)) {
          onStoreChange();
        }
      };

      const handleCustom = (event) => {
        if (event.detail?.role === role) {
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
    [role]
  );

  const rawValue = useSyncExternalStore(
    subscribe,
    () => readRawValue(role),
    () => ""
  );

  const settings = useMemo(() => {
    try {
      if (!rawValue) {
        return DEFAULTS[role];
      }

      const parsed = JSON.parse(rawValue);
      const isLegacyUmpireSetting =
        role === "umpire" &&
        (!parsed.version || parsed.version < SETTINGS_VERSION);

      return {
        ...DEFAULTS[role],
        ...parsed,
        ...(isLegacyUmpireSetting ? { enabled: true } : {}),
        version: SETTINGS_VERSION,
      };
    } catch (error) {
      console.error("Failed to load announcer settings:", error);
      return DEFAULTS[role];
    }
  }, [rawValue, role]);

  useEffect(() => {
    if (typeof window === "undefined" || !rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed.version || parsed.version < SETTINGS_VERSION) {
        window.localStorage.setItem(getStorageKey(role), JSON.stringify(settings));
      }
    } catch {
      window.localStorage.setItem(getStorageKey(role), JSON.stringify(settings));
    }
  }, [rawValue, role, settings]);

  const updateSetting = (key, value) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const nextSettings = {
        ...settings,
        [key]: value,
      };
      window.localStorage.setItem(
        getStorageKey(role),
        JSON.stringify(nextSettings)
      );
      window.dispatchEvent(
        new CustomEvent("gv-announcer-change", {
          detail: { role },
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
