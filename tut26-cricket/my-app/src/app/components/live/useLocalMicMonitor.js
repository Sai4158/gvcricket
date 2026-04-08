"use client";

/**
 * File overview:
 * Purpose: React hook for Live behavior and browser state.
 * Main exports: useLocalMicMonitor.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  duckPageMedia,
  playUiTone,
  primeUiAudio,
  restorePreferredAudioSessionType,
  restorePageMedia,
  setPreferredAudioSessionType,
} from "../../lib/page-audio";

function getMicErrorMessage(error) {
  const name = String(error?.name || "");

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was blocked on this device.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found on this device.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is busy in another app or tab.";
  }

  return "Could not start the live microphone in this browser.";
}

export default function useLocalMicMonitor() {
  const sessionGenerationRef = useRef(0);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioContextRef = useRef(null);
  const startPromiseRef = useRef(null);
  const preparePromiseRef = useRef(null);
  const gainLevelRef = useRef(2);
  const pausedMediaRef = useRef([]);
  const audioSessionTypeRef = useRef("");
  const permissionPrimedRef = useRef(false);
  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [gainLevel, setGainLevelState] = useState(2);
  const [error, setError] = useState("");

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const stop = useCallback(
    async ({
      resumeMedia = false,
      preserveGeneration = false,
      disposeAudioContext = false,
    } = {}) => {
      const wasLive = Boolean(
        streamRef.current || isActiveRef.current || isPausedRef.current
      );

      if (!preserveGeneration) {
        sessionGenerationRef.current += 1;
      }

      try {
        sourceRef.current?.disconnect();
        gainNodeRef.current?.disconnect();
      } catch {
        // Disconnect can throw if nodes are already closed.
      }

      sourceRef.current = null;
      gainNodeRef.current = null;

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      const audioContext = audioContextRef.current;
      if (audioContext) {
        try {
          if (disposeAudioContext) {
            await audioContext.close();
            audioContextRef.current = null;
          } else if (audioContext.state === "running") {
            await audioContext.suspend();
          }
        } catch {
          if (disposeAudioContext) {
            audioContextRef.current = null;
          }
        }
      }

      setIsActive(false);
      setIsPaused(false);
      setIsStarting(false);

      if (resumeMedia) {
        restorePageMedia(pausedMediaRef);
      }

      if (audioSessionTypeRef.current) {
        restorePreferredAudioSessionType(audioSessionTypeRef.current);
        audioSessionTypeRef.current = "";
      }

      if (wasLive) {
        playUiTone({ frequency: 640, durationMs: 140, type: "triangle", volume: 0.035 });
      }
    },
    []
  );

  const prepare = useCallback(async ({ requestPermission = false } = {}) => {
    if (preparePromiseRef.current) {
      return preparePromiseRef.current;
    }

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      return false;
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return false;
    }

    setError("");

    preparePromiseRef.current = (async () => {
      let prepared = await primeUiAudio();

      try {
        let audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === "closed") {
          audioContext = new AudioContextClass({ latencyHint: "interactive" });
          audioContextRef.current = audioContext;
        }

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        if (audioContext.state === "running") {
          await audioContext.suspend();
        }

        prepared = true;
      } catch {
        // Keep best-effort prewarm only.
      }

      if (
        !requestPermission ||
        permissionPrimedRef.current ||
        isActiveRef.current ||
        isPausedRef.current
      ) {
        return prepared;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            latency: 0,
            sampleRate: 48000,
          },
          video: false,
        });

        for (const track of stream.getTracks()) {
          track.stop();
        }

        permissionPrimedRef.current = true;
        return true;
      } catch (nextError) {
        setError(getMicErrorMessage(nextError));
        return false;
      }
    })().finally(() => {
      preparePromiseRef.current = null;
    });

    return preparePromiseRef.current;
  }, []);

  const start = async ({
    pauseMedia = false,
    startPaused = false,
    playStartCue = true,
  } = {}) => {
    if (startPromiseRef.current) {
      return startPromiseRef.current;
    }

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      setError("Live microphone monitoring is not supported in this browser.");
      return false;
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      setError("Live microphone monitoring is not supported in this browser.");
      return false;
    }

    setError("");
    setIsStarting(true);

    startPromiseRef.current = (async () => {
      try {
        await prepare();
        await stop({ resumeMedia: false, preserveGeneration: true });

        const currentGeneration = sessionGenerationRef.current + 1;
        sessionGenerationRef.current = currentGeneration;

        if (pauseMedia) {
          duckPageMedia(pausedMediaRef, 0.18);
        }

        audioSessionTypeRef.current =
          setPreferredAudioSessionType("play-and-record") || "";

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            latency: 0,
            sampleRate: 48000,
          },
          video: false,
        });

        if (
          sessionGenerationRef.current !== currentGeneration ||
          (typeof document !== "undefined" &&
            document.visibilityState === "hidden")
        ) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          if (pauseMedia) {
            restorePageMedia(pausedMediaRef);
          }
          return false;
        }

        let audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === "closed") {
          audioContext = new AudioContextClass({ latencyHint: "interactive" });
          audioContextRef.current = audioContext;
        }
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = gainLevelRef.current;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (startPaused) {
          try {
            await audioContext.suspend();
          } catch {
            // Keep the stream active if Safari refuses an immediate suspend.
          }
        }

        streamRef.current = stream;
        sourceRef.current = source;
        gainNodeRef.current = gainNode;
        permissionPrimedRef.current = true;
        setIsActive(true);
        setIsPaused(audioContext.state !== "running");
        if (playStartCue && audioContext.state === "running") {
          playUiTone({ frequency: 880, durationMs: 140, type: "sine", volume: 0.04 });
        }
        return true;
      } catch (nextError) {
        await stop({ resumeMedia: pauseMedia });
        setError(getMicErrorMessage(nextError));
        return false;
      } finally {
        setIsStarting(false);
        startPromiseRef.current = null;
      }
    })();

    return startPromiseRef.current;
  };

  const setGainLevel = (nextLevel) => {
    const safeLevel = Math.min(2, Math.max(0, Number(nextLevel) || 0));
    gainLevelRef.current = safeLevel;
    setGainLevelState(safeLevel);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = safeLevel;
    }
  };

  const pause = async ({ resumeMedia = false } = {}) => {
    if (!audioContextRef.current || !isActive || isPaused) {
      return false;
    }

    try {
      await audioContextRef.current.suspend();
      setIsPaused(true);
      if (resumeMedia) {
        restorePageMedia(pausedMediaRef);
      }
      return true;
    } catch {
      setError("Could not pause the live microphone.");
      return false;
    }
  };

  const resume = async ({ pauseMedia = false } = {}) => {
    if (!audioContextRef.current || !isActive || !isPaused) {
      return false;
    }

    try {
      if (pauseMedia) {
        duckPageMedia(pausedMediaRef, 0.18);
      }
      await audioContextRef.current.resume();
      setIsPaused(false);
      return true;
    } catch {
      setError("Could not resume the live microphone.");
      return false;
    }
  };

  useEffect(() => {
    return () => {
      void stop({ disposeAudioContext: true });
    };
  }, [stop]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const stopIfBackgrounded = () => {
      if (document.visibilityState === "hidden") {
        void stop({ resumeMedia: true });
      }
    };

    const stopOnPageHide = () => {
      void stop({ resumeMedia: true });
    };

    document.addEventListener("visibilitychange", stopIfBackgrounded);
    window.addEventListener("pagehide", stopOnPageHide);

    return () => {
      document.removeEventListener("visibilitychange", stopIfBackgrounded);
      window.removeEventListener("pagehide", stopOnPageHide);
    };
  }, [stop]);

  return {
    isActive,
    isPaused,
    isStarting,
    gainLevel,
    error,
    start,
    prepare,
    pause,
    resume,
    stop,
    setGainLevel,
  };
}
