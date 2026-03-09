"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickAmericanVoice(voices) {
  const preferredNames = [
    "Samantha",
    "Ava",
    "Allison",
    "Nicky",
    "Evan",
    "Moira",
    "Microsoft Aria Online",
    "Microsoft Jenny Online",
    "Microsoft Guy Online",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Guy",
    "Zira",
    "Aria",
    "Jenny",
    "Google US English",
  ];

  for (const name of preferredNames) {
    const match = voices.find((voice) => voice.name.includes(name));
    if (match) return match;
  }

  return (
    voices.find(
      (voice) =>
        voice.lang?.toLowerCase().startsWith("en-us") && voice.localService
    ) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en-us")) ||
    voices.find(
      (voice) => voice.lang?.toLowerCase().startsWith("en") && voice.localService
    ) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .replace(/(\d+)\s*\/\s*(\d+)/g, "$1 for $2")
    .trim();
}

function getSpeechProfile(voice, options) {
  const voiceName = voice?.name?.toLowerCase() || "";
  const isAppleNatural =
    voiceName.includes("samantha") ||
    voiceName.includes("ava") ||
    voiceName.includes("allison") ||
    voiceName.includes("nicky");
  const isMicrosoftNatural =
    voiceName.includes("aria") ||
    voiceName.includes("jenny") ||
    voiceName.includes("guy");

  return {
    rate:
      options.rate ??
      (isAppleNatural ? 0.9 : isMicrosoftNatural ? 0.92 : 0.94),
    pitch: options.pitch ?? (isAppleNatural ? 0.96 : 0.98),
  };
}

function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
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
    if (!canUseSpeechSynthesis()) return undefined;

    let retryTimer = null;
    let retries = 0;

    const assignVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoice(pickAmericanVoice(voices));
        setStatus((current) => (current === "unsupported" ? current : "ready"));
        return true;
      }

      if (retries < 8) {
        retries += 1;
        retryTimer = window.setTimeout(assignVoice, 250);
      }

      return false;
    };

    assignVoice();
    window.speechSynthesis.addEventListener("voiceschanged", assignVoice);
    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      window.speechSynthesis.removeEventListener("voiceschanged", assignVoice);
    };
  }, []);

  const performSpeak = useCallback(
    (text, options = {}) => {
      if (
        !text ||
        (!settings.enabled && !options.ignoreEnabled) ||
        settings.muted ||
        settings.mode === "silent" ||
        !canUseSpeechSynthesis()
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

      if (
        options.interrupt !== false &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      ) {
        window.speechSynthesis.cancel();
      }

      try {
        window.speechSynthesis.resume?.();
      } catch {
        // Ignore resume failures and try to speak anyway.
      }

      const utterance = new SpeechSynthesisUtterance(normalizeSpeechText(text));
      const profile = getSpeechProfile(voice, options);
      utterance.voice = voice;
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = settings.volume;
      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => setStatus("ready");
      utterance.onerror = () => {
        setStatus("blocked");
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setStatus("blocked");
        return false;
      }

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
    if (!canUseSpeechSynthesis()) {
      setStatus("unsupported");
      return false;
    }

    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.resume?.();

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
    if (!canUseSpeechSynthesis()) return undefined;

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
        isPrimedRef.current = true;
        setStatus((current) => (current === "unsupported" ? current : "ready"));
        try {
          window.speechSynthesis?.resume?.();
        } catch {
          // Ignore resume failures and continue with direct user-gesture speech.
        }
        pendingSpeakRef.current = null;
        return performSpeak(text, options);
      }

      if (!isPrimedRef.current) {
        pendingSpeakRef.current = { text, options };
        setStatus("waiting_for_gesture");
        return false;
      }

      return performSpeak(text, options);
    },
    [performSpeak]
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
