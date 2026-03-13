"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { duckPageMedia, playUiTone, restorePageMedia } from "../../lib/page-audio";

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
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainLevelRef = useRef(2);
  const pausedMediaRef = useRef([]);
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

  const stop = useCallback(async ({ resumeMedia = false } = {}) => {
    const wasLive = Boolean(
      streamRef.current || isActiveRef.current || isPausedRef.current
    );

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

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // Ignore close errors during teardown.
      }
      audioContextRef.current = null;
    }

    setIsActive(false);
    setIsPaused(false);

    if (resumeMedia) {
      restorePageMedia(pausedMediaRef);
    }

    if (wasLive) {
      playUiTone({ frequency: 640, durationMs: 140, type: "triangle", volume: 0.035 });
    }
  }, []);

  const start = async ({ pauseMedia = false } = {}) => {
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

    try {
      await stop({ resumeMedia: false });

      if (pauseMedia) {
        duckPageMedia(pausedMediaRef, 0.18);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      const audioContext = new AudioContextClass({ latencyHint: "interactive" });
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = gainLevelRef.current;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      streamRef.current = stream;
      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      audioContextRef.current = audioContext;
      setIsActive(true);
      setIsPaused(false);
      playUiTone({ frequency: 880, durationMs: 140, type: "sine", volume: 0.04 });
      return true;
    } catch (nextError) {
      await stop({ resumeMedia: pauseMedia });
      setError(getMicErrorMessage(nextError));
      return false;
    } finally {
      setIsStarting(false);
    }
  };

  const setGainLevel = (nextLevel) => {
    const safeLevel = Math.min(2, Math.max(0, Number(nextLevel) || 0));
    gainLevelRef.current = safeLevel;
    setGainLevelState(safeLevel);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = safeLevel;
    }
  };

  const pause = async () => {
    if (!audioContextRef.current || !isActive || isPaused) {
      return false;
    }

    try {
      await audioContextRef.current.suspend();
      setIsPaused(true);
      return true;
    } catch {
      setError("Could not pause the live microphone.");
      return false;
    }
  };

  const resume = async () => {
    if (!audioContextRef.current || !isActive || !isPaused) {
      return false;
    }

    try {
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
      void stop();
    };
  }, [stop]);

  return {
    isActive,
    isPaused,
    isStarting,
    gainLevel,
    error,
    start,
    pause,
    resume,
    stop,
    setGainLevel,
  };
}
