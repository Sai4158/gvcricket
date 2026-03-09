"use client";

import { useMemo, useSyncExternalStore } from "react";

const DEFAULTS = {
  spectator: {
    enabled: false,
    muted: false,
    volume: 0.85,
    mode: "full",
    accessibilityMode: false,
  },
  umpire: {
    enabled: false,
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
      return rawValue
        ? {
            ...DEFAULTS[role],
            ...JSON.parse(rawValue),
          }
        : DEFAULTS[role];
    } catch (error) {
      console.error("Failed to load announcer settings:", error);
      return DEFAULTS[role];
    }
  }, [rawValue, role]);

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
