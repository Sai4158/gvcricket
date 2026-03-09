"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickAmericanVoice(voices) {
  const preferredNames = [
    "Google US English",
    "Microsoft Jenny Online",
    "Microsoft Aria Online",
    "Microsoft Guy Online",
    "Microsoft Jenny",
    "Microsoft Aria",
    "Microsoft Guy",
    "Samantha",
    "Zira",
    "Jenny",
    "Aria",
  ];

  for (const name of preferredNames) {
    const match = voices.find((voice) => voice.name.includes(name));
    if (match) return match;
  }

  return (
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en-us")) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}

export default function useSpeechAnnouncer(settings) {
  const [voice, setVoice] = useState(null);
  const [status, setStatus] = useState(() => {
    if (typeof window === "undefined") return "idle";
    return window.speechSynthesis ? "idle" : "unsupported";
  });
  const lastSpokenRef = useRef({ key: "", at: 0 });
  const isPrimedRef = useRef(false);
  const pendingSpeakRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;

    const assignVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoice(pickAmericanVoice(voices));
      setStatus((current) => (current === "unsupported" ? current : "ready"));
    };

    assignVoice();
    window.speechSynthesis.addEventListener("voiceschanged", assignVoice);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", assignVoice);
  }, []);

  const performSpeak = useCallback(
    (text, options = {}) => {
      if (
        !text ||
        !settings.enabled ||
        settings.muted ||
        settings.mode === "silent" ||
        typeof window === "undefined" ||
        !window.speechSynthesis
      ) {
        return false;
      }

      const key = options.key || text;
      const now = Date.now();
      const minGap = options.minGapMs ?? 450;
      if (
        lastSpokenRef.current.key === key &&
        now - lastSpokenRef.current.at < minGap
      ) {
        return false;
      }

      lastSpokenRef.current = { key, at: now };

      if (options.interrupt !== false) {
        window.speechSynthesis.cancel();
      }

      try {
        window.speechSynthesis.resume?.();
      } catch {
        // Ignore resume failures and try to speak anyway.
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = settings.volume;
      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => setStatus("ready");
      utterance.onerror = () => {
        setStatus("blocked");
      };

      window.speechSynthesis.speak(utterance);

      return true;
    },
    [
      settings.enabled,
      settings.mode,
      settings.muted,
      settings.volume,
      voice,
    ]
  );

  const prime = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setStatus("unsupported");
      return false;
    }

    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.resume?.();

      const unlockUtterance = new SpeechSynthesisUtterance(" ");
      unlockUtterance.volume = 0;
      unlockUtterance.rate = 1;
      unlockUtterance.pitch = 1;
      window.speechSynthesis.speak(unlockUtterance);
      window.speechSynthesis.cancel();

      isPrimedRef.current = true;
      setStatus("ready");

      if (pendingSpeakRef.current) {
        const nextPending = pendingSpeakRef.current;
        pendingSpeakRef.current = null;
        performSpeak(nextPending.text, nextPending.options);
      }

      return true;
    } catch {
      setStatus("blocked");
      return false;
    }
  }, [performSpeak]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;

    const primeFromGesture = () => {
      if (!isPrimedRef.current) {
        prime();
      }
    };

    window.addEventListener("pointerdown", primeFromGesture, { passive: true });
    window.addEventListener("keydown", primeFromGesture);
    window.addEventListener("touchstart", primeFromGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", primeFromGesture);
      window.removeEventListener("keydown", primeFromGesture);
      window.removeEventListener("touchstart", primeFromGesture);
    };
  }, [prime]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        try {
          window.speechSynthesis?.resume?.();
        } catch {
          // Ignore resume failures after tab restore.
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const speak = useCallback(
    (text, options = {}) => {
      if (options.userGesture) {
        prime();
      }

      if (!isPrimedRef.current && !options.userGesture) {
        pendingSpeakRef.current = { text, options };
        setStatus("waiting_for_gesture");
        return false;
      }

      return performSpeak(text, options);
    },
    [performSpeak, prime]
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    pendingSpeakRef.current = null;
    window.speechSynthesis.cancel();
    setStatus((current) => (current === "unsupported" ? current : "ready"));
  }, []);

  return {
    speak,
    prime,
    stop,
    isSupported: status !== "unsupported",
    status,
    voiceName: voice?.name || "",
  };
}
