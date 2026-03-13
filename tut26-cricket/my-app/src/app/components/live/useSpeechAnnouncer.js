"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getVoiceScore(voice) {
  const name = voice?.name?.toLowerCase() || "";
  const lang = voice?.lang?.toLowerCase() || "";

  let score = 0;

  if (lang.startsWith("en-us")) score += 80;
  else if (lang.startsWith("en")) score += 45;

  if (voice?.default) score += 12;
  if (voice?.localService) score += 10;

  if (name.includes("natural")) score += 80;
  if (name.includes("premium")) score += 40;
  if (name.includes("enhanced")) score += 35;
  if (name.includes("neural")) score += 35;
  if (name.includes("online")) score += 25;

  if (name.includes("samantha")) score += 120;
  if (name.includes("ava")) score += 110;
  if (name.includes("allison")) score += 105;
  if (name.includes("nicky")) score += 100;
  if (name.includes("google us english")) score += 95;
  if (name.includes("google")) score += 55;
  if (name.includes("microsoft aria")) score += 100;
  if (name.includes("microsoft jenny")) score += 95;
  if (name.includes("microsoft guy")) score += 90;
  if (name.includes("aria")) score += 40;
  if (name.includes("jenny")) score += 35;
  if (name.includes("guy")) score += 30;
  if (name.includes("zira")) score -= 80;
  if (name.includes("david")) score -= 30;
  if (name.includes("mark")) score -= 15;

  return score;
}

function pickAmericanVoice(voices) {
  const englishVoices = voices.filter((voice) =>
    voice?.lang?.toLowerCase().startsWith("en")
  );

  if (!englishVoices.length) {
    return null;
  }

  return [...englishVoices].sort((a, b) => getVoiceScore(b) - getVoiceScore(a))[0];
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
  const isGoogleNatural = voiceName.includes("google");
  const isLegacyVoice = voiceName.includes("zira") || voiceName.includes("david");

  return {
    rate:
      options.rate ??
      (isAppleNatural
        ? 0.86
        : isGoogleNatural
        ? 0.88
        : isMicrosoftNatural
        ? 0.89
        : isLegacyVoice
        ? 0.83
        : 0.9),
    pitch:
      options.pitch ??
      (isAppleNatural ? 0.95 : isGoogleNatural ? 0.97 : isLegacyVoice ? 0.92 : 0.96),
  };
}

function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}

function normalizeSpeechError(error) {
  const value = String(error || "").toLowerCase();
  if (value.includes("not-allowed")) return "not-allowed";
  if (value.includes("interrupted")) return "interrupted";
  if (value.includes("canceled") || value.includes("cancelled")) return "canceled";
  return value;
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
  const currentSequenceRef = useRef(null);
  const queuedSequencesRef = useRef([]);
  const utteranceRef = useRef(null);
  const stepTimerRef = useRef(null);
  const sequenceTokenRef = useRef(0);

  const clearStepTimer = useCallback(() => {
    if (stepTimerRef.current) {
      window.clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  const hardStop = useCallback(() => {
    clearStepTimer();
    currentSequenceRef.current = null;
    queuedSequencesRef.current = [];
    utteranceRef.current = null;
    sequenceTokenRef.current += 1;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setStatus((current) => (current === "unsupported" ? current : "ready"));
  }, [clearStepTimer]);

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

  const runSequence = useCallback(
    (sequence, token = sequenceTokenRef.current) => {
      if (!sequence?.items?.length || !canUseSpeechSynthesis()) {
        setStatus((current) => (current === "unsupported" ? current : "ready"));
        return false;
      }

      currentSequenceRef.current = sequence;
      const nextItem = sequence.items[sequence.index] || null;
      if (!nextItem?.text) {
        const pending = queuedSequencesRef.current.shift() || null;
        currentSequenceRef.current = null;
        if (pending) {
          return runSequence({ ...pending, index: 0 }, sequenceTokenRef.current);
        }
        setStatus((current) => (current === "unsupported" ? current : "ready"));
        return true;
      }

      try {
        window.speechSynthesis.resume?.();
      } catch {
        // Ignore resume failures and keep going.
      }

      const utterance = new SpeechSynthesisUtterance(normalizeSpeechText(nextItem.text));
      const profile = getSpeechProfile(voice, nextItem);
      if (voice && !sequence.useSystemVoice) {
        utterance.voice = voice;
      }
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = settings.volume;
      utteranceRef.current = utterance;

      utterance.onstart = () => {
        if (token !== sequenceTokenRef.current) {
          return;
        }
        setStatus("speaking");
      };

      utterance.onend = () => {
        if (token !== sequenceTokenRef.current) {
          return;
        }

        utteranceRef.current = null;
        const pauseAfterMs = nextItem.pauseAfterMs ?? sequence.pauseAfterMs ?? 0;
        const nextSequence = {
          ...sequence,
          index: sequence.index + 1,
        };

        clearStepTimer();
        stepTimerRef.current = window.setTimeout(() => {
          if (token !== sequenceTokenRef.current) {
            return;
          }
          runSequence(nextSequence, token);
        }, pauseAfterMs);
      };

      utterance.onerror = (event) => {
        if (token !== sequenceTokenRef.current) {
          return;
        }

        const errorType = normalizeSpeechError(event?.error);

        if (errorType === "interrupted" || errorType === "canceled") {
          utteranceRef.current = null;
          currentSequenceRef.current = null;
          queuedSequencesRef.current = [];
          setStatus((current) => (current === "unsupported" ? current : "ready"));
          return;
        }

        if (errorType === "not-allowed") {
          utteranceRef.current = null;
          currentSequenceRef.current = null;
          queuedSequencesRef.current = [];
          setStatus("waiting_for_gesture");
          return;
        }

        if (voice && !sequence.useSystemVoice && !sequence.fallbackTried) {
          utteranceRef.current = null;
          currentSequenceRef.current = null;
          clearStepTimer();
          sequenceTokenRef.current += 1;
          return runSequence(
            {
              ...sequence,
              useSystemVoice: true,
              fallbackTried: true,
            },
            sequenceTokenRef.current
          );
        }

        utteranceRef.current = null;
        currentSequenceRef.current = null;
        queuedSequencesRef.current = [];
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
    [clearStepTimer, settings.volume, voice]
  );

  const queueSequence = useCallback(
    (items, options = {}) => {
      if (
        !items?.length ||
        (!settings.enabled && !options.ignoreEnabled) ||
        settings.muted ||
        settings.mode === "silent" ||
        !canUseSpeechSynthesis()
      ) {
        return false;
      }

      const normalizedItems = items
        .map((item) =>
          typeof item === "string"
            ? { text: item, pauseAfterMs: options.pauseAfterMs ?? 0 }
            : {
                ...item,
                text: item?.text || "",
              }
        )
        .filter((item) => item.text);

      if (!normalizedItems.length) {
        return false;
      }

      const key = options.key || normalizedItems.map((item) => item.text).join("|");
      const now = Date.now();
      const minGap = options.minGapMs ?? 450;
      if (
        lastSpokenRef.current.key === key &&
        now - lastSpokenRef.current.at < minGap
      ) {
        return false;
      }

      lastSpokenRef.current = { key, at: now };

      const request = {
        key,
        items: normalizedItems,
        index: 0,
        pauseAfterMs: options.pauseAfterMs ?? 0,
        priority: options.priority ?? 1,
        fallbackTried: options.fallbackTried ?? false,
      };

      if (!isPrimedRef.current && !options.userGesture) {
        pendingSpeakRef.current = { type: "sequence", items: normalizedItems, options };
        setStatus("waiting_for_gesture");
        return false;
      }

      if (options.userGesture) {
        isPrimedRef.current = true;
        setStatus((current) => (current === "unsupported" ? current : "ready"));
      }

      const hasActiveSpeech =
        Boolean(currentSequenceRef.current) ||
        Boolean(utteranceRef.current) ||
        Boolean(stepTimerRef.current) ||
        window.speechSynthesis.speaking ||
        window.speechSynthesis.pending;

      if (!hasActiveSpeech) {
        clearStepTimer();
        sequenceTokenRef.current += 1;
        return runSequence(request, sequenceTokenRef.current);
      }

      const currentPriority = currentSequenceRef.current?.priority ?? 1;
      if (options.interrupt === true || request.priority > currentPriority) {
        clearStepTimer();
        queuedSequencesRef.current = [];
        sequenceTokenRef.current += 1;
        window.speechSynthesis.cancel();
        return runSequence(request, sequenceTokenRef.current);
      }

      queuedSequencesRef.current.push(request);
      return true;
    },
    [
      clearStepTimer,
      runSequence,
      settings.enabled,
      settings.mode,
      settings.muted,
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
        if (nextPending.type === "sequence") {
          queueSequence(nextPending.items, nextPending.options);
        } else {
          queueSequence([{ text: nextPending.text }], nextPending.options);
        }
      }

      return true;
    } catch {
      setStatus("blocked");
      return false;
    }
  }, [queueSequence]);

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
        return queueSequence([{ text }], options);
      }

      if (!isPrimedRef.current) {
        pendingSpeakRef.current = { type: "single", text, options };
        setStatus("waiting_for_gesture");
        return false;
      }

      return queueSequence([{ text }], options);
    },
    [queueSequence]
  );

  const speakSequence = useCallback(
    (items, options = {}) => queueSequence(items, options),
    [queueSequence]
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    pendingSpeakRef.current = null;
    hardStop();
  }, [hardStop]);

  useEffect(() => () => hardStop(), [hardStop]);

  return {
    speak,
    speakSequence,
    prime,
    stop,
    isSupported: status !== "unsupported",
    isSpeaking: status === "speaking",
    needsGesture: status === "waiting_for_gesture",
    status,
    voiceName: voice?.name || "",
  };
}
