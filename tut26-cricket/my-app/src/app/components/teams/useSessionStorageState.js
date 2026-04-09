"use client";

/**
 * File overview:
 * Purpose: Encapsulates Teams browser state, effects, and runtime coordination.
 * Main exports: useSessionStorageState.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ./README.md
 */


import { useEffect, useRef, useState } from "react";

export default function useSessionStorageState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);
  const [storageReady, setStorageReady] = useState(false);
  const defaultValueRef = useRef(defaultValue);

  defaultValueRef.current = defaultValue;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.sessionStorage.getItem(key);
    if (!storedValue) {
      setState(defaultValueRef.current);
      setStorageReady(true);
      return;
    }

    try {
      setState(JSON.parse(storedValue));
    } catch (error) {
      console.error("Error parsing session storage value", error);
      setState(defaultValueRef.current);
    } finally {
      setStorageReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state, storageReady]);

  return [state, setState];
}


