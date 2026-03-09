"use client";

import { useEffect, useState } from "react";

export default function useSessionStorageState(key, defaultValue) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return defaultValue;

    const storedValue = window.sessionStorage.getItem(key);
    if (!storedValue) return defaultValue;

    try {
      return JSON.parse(storedValue);
    } catch (error) {
      console.error("Error parsing session storage value", error);
      return defaultValue;
    }
  });

  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
