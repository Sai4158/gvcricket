"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  return "Could not start the live microphone on this browser.";
}

export default function useLocalMicMonitor() {
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainLevelRef = useRef(2);
  const pausedMediaRef = useRef([]);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [gainLevel, setGainLevelState] = useState(2);
  const [error, setError] = useState("");

  const pausePageMedia = () => {
    if (typeof document === "undefined") {
      return;
    }

    const pausedMedia = [];
    const elements = document.querySelectorAll("audio, video");

    elements.forEach((element) => {
      if (!element.paused && !element.ended) {
        pausedMedia.push(element);
        void element.pause();
      }
    });

    pausedMediaRef.current = pausedMedia;
  };

  const resumePausedMedia = () => {
    const pausedMedia = pausedMediaRef.current;
    pausedMediaRef.current = [];

    pausedMedia.forEach((element) => {
      void element.play().catch(() => {});
    });
  };

  const stop = useCallback(async ({ resumeMedia = false } = {}) => {
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
      resumePausedMedia();
    }
  }, []);

  const start = async ({ pauseMedia = false } = {}) => {
    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      setError("Live microphone monitor is not supported on this browser.");
      return false;
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      setError("Live microphone monitor is not supported on this browser.");
      return false;
    }

    setError("");
    setIsStarting(true);

    try {
      await stop({ resumeMedia: false });

      if (pauseMedia) {
        pausePageMedia();
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

  useEffect(() => () => {
    void stop();
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
