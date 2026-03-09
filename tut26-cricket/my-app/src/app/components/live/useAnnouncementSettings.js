"use client";

import { useEffect, useState } from "react";

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

export default function useAnnouncementSettings(role) {
  const storageKey = `gv-announcer-${role}`;
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULTS[role];
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return DEFAULTS[role];
      }

      return {
        ...DEFAULTS[role],
        ...JSON.parse(stored),
      };
    } catch (error) {
      console.error("Failed to load announcer settings:", error);
      return DEFAULTS[role];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save announcer settings:", error);
    }
  }, [settings, storageKey]);

  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return {
    settings,
    updateSetting,
  };
}
