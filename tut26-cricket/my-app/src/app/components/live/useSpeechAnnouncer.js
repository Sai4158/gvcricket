"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUiAudioUnlocked, subscribeUiAudioUnlock } from "../../lib/page-audio";

const SAFARI_PREFERRED_VOICE_NAMES = [
  "siri voice 4 enhanced",
  "siri voice 4 premium",
  "siri voice 4 natural",
  "siri voice 4",
  "siri female",
  "siri",
  "samantha enhanced",
  "samantha premium",
  "samantha natural",
  "samantha",
  "ava enhanced",
  "ava premium",
  "ava natural",
  "ava",
  "allison enhanced",
  "allison premium",
  "allison natural",
  "allison",
  "nicky enhanced",
  "nicky premium",
  "nicky natural",
  "nicky",
];
const CHROME_PREFERRED_VOICE_NAMES = [
  "google uk english female",
  "google us english",
  "google english",
];
const DESKTOP_PREFERRED_VOICE_NAMES = [
  "microsoft aria online",
  "microsoft jenny online",
  "microsoft aria",
  "microsoft jenny",
  "google uk english female",
  "google us english",
  "google english",
  "samantha",
  "ava",
  "allison",
  "nicky",
];
const FEMALE_VOICE_KEYWORDS = [
  "female",
  "samantha",
  "ava",
  "allison",
  "nicky",
  "aria",
  "jenny",
  "zira",
  "siri voice 4",
  "siri",
];

function getSpeechPlatform() {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isSafari: false,
      isChrome: false,
    };
  }

  const userAgent = window.navigator?.userAgent || "";
  const vendor = window.navigator?.vendor || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator?.platform === "MacIntel" && window.navigator?.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|EdgiOS|FxiOS|OPiOS/i.test(userAgent) &&
    /Apple/i.test(vendor);
  const isChrome = /Chrome|CriOS/i.test(userAgent);

  return { isIOS, isSafari, isChrome };
}

function getVoiceScore(voice, platform) {
  const name = voice?.name?.toLowerCase() || "";
  const lang = voice?.lang?.toLowerCase() || "";
  const { isIOS, isSafari, isChrome } = platform || {};

  let score = 0;

  if (lang.startsWith("en-us")) score += 80;
  else if (lang.startsWith("en")) score += 45;

  if (voice?.default) score += 12;
  if (voice?.localService) score += 10;

  if (name.includes("natural")) score += 80;
  if (name.includes("premium")) score += 40;
  if (name.includes("enhanced")) score += 35;
  if (name.includes("neural")) score += 35;
  if (name.includes("female")) score += 24;
  if (name.includes("online")) score += 25;
  if (name.includes("compact")) score -= 20;

  if (name.includes("siri voice 4")) score += 320;
  if (name.includes("siri")) score += 180;
  if (name.includes("samantha")) score += 120;
  if (name.includes("samantha") && name.includes("enhanced")) score += 180;
  if (name.includes("ava")) score += 110;
  if (name.includes("ava") && name.includes("enhanced")) score += 150;
  if (name.includes("allison")) score += 105;
  if (name.includes("allison") && name.includes("enhanced")) score += 145;
  if (name.includes("nicky")) score += 100;
  if (name.includes("nicky") && name.includes("enhanced")) score += 140;
  if (name.includes("google uk english female")) score += 110;
  if (name.includes("google us english")) score += 95;
  if (name.includes("google")) score += 55;
  if (name.includes("microsoft aria")) score += 100;
  if (name.includes("microsoft jenny")) score += 95;
  if (name.includes("microsoft guy")) score += 42;
  if (name.includes("aria")) score += 40;
  if (name.includes("jenny")) score += 35;
  if (name.includes("guy")) score += 8;
  if (name.includes("zira")) score -= 110;
  if (name.includes("david")) score -= 50;
  if (name.includes("mark")) score -= 24;
  if (name.includes("fred")) score -= 160;
  if (name.includes("zarvox")) score -= 180;
  if (name.includes("bahh")) score -= 180;
  if (name.includes("bells")) score -= 180;
  if (name.includes("boing")) score -= 180;

  if (isSafari) {
    if (name.includes("siri voice 4")) score += 420;
    if (name.includes("siri")) score += 260;
    if (name.includes("samantha")) score += 260;
    if (name.includes("ava")) score += 220;
    if (name.includes("allison")) score += 200;
    if (name.includes("nicky")) score += 185;
    if (name.includes("fred")) score -= 180;
    if (name.includes("zarvox")) score -= 180;
    if (name.includes("bahh")) score -= 180;
    if (name.includes("bells")) score -= 180;
    if (name.includes("boing")) score -= 180;
  }

  if (isChrome) {
    if (name.includes("google uk english female")) score += 180;
    if (name.includes("google us english")) score += 140;
    if (name.includes("google english")) score += 110;
  }

  return score;
}

function pickPreferredVoiceByName(voices, preferredNames) {
  for (const preferredName of preferredNames) {
    const found = voices.find((voice) =>
      (voice?.name?.toLowerCase() || "").includes(preferredName)
    );
    if (found) {
      return found;
    }
  }

  return null;
}

function isLikelyFemaleVoice(voice) {
  const name = voice?.name?.toLowerCase() || "";
  return FEMALE_VOICE_KEYWORDS.some((keyword) => name.includes(keyword));
}

function pickLockedVoice(voices, lockedVoiceName) {
  if (!lockedVoiceName) {
    return null;
  }

  return (
    voices.find(
      (voice) => (voice?.name || "").toLowerCase() === lockedVoiceName.toLowerCase()
    ) || null
  );
}

function pickAmericanVoice(voices, platform, options = {}) {
  const { excludeNames = [], lockedVoiceName = "" } = options;
  const excluded = new Set(excludeNames.map((name) => String(name || "").toLowerCase()));
  const englishVoices = voices.filter(
    (voice) =>
      voice?.lang?.toLowerCase().startsWith("en") &&
      !excluded.has((voice?.name || "").toLowerCase())
  );

  if (!englishVoices.length) {
    return null;
  }

  const lockedVoice = pickLockedVoice(englishVoices, lockedVoiceName);
  if (lockedVoice) {
    return lockedVoice;
  }

  const femaleEnglishVoices = englishVoices.filter(isLikelyFemaleVoice);
  const candidateVoices = femaleEnglishVoices.length ? femaleEnglishVoices : englishVoices;

  if (platform?.isSafari) {
    return (
      pickPreferredVoiceByName(candidateVoices, SAFARI_PREFERRED_VOICE_NAMES) ||
      [...candidateVoices].sort(
        (a, b) => getVoiceScore(b, platform) - getVoiceScore(a, platform)
      )[0]
    );
  }

  if (platform?.isChrome) {
    return (
      pickPreferredVoiceByName(candidateVoices, CHROME_PREFERRED_VOICE_NAMES) ||
      [...candidateVoices].sort(
        (a, b) => getVoiceScore(b, platform) - getVoiceScore(a, platform)
      )[0]
    );
  }

  return (
    pickPreferredVoiceByName(candidateVoices, DESKTOP_PREFERRED_VOICE_NAMES) ||
    [...candidateVoices].sort(
      (a, b) => getVoiceScore(b, platform) - getVoiceScore(a, platform)
    )[0]
  );
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .replace(/(\d+)\s*\/\s*(\d+)/g, "$1 for $2")
    .trim();
}

function dedupeRepeatedLeadPhrase(text) {
  const normalized = normalizeSpeechText(text);
  if (!normalized) {
    return "";
  }

  const words = normalized.split(" ").filter(Boolean);
  for (let size = 4; size >= 1; size -= 1) {
    if (words.length < size * 2) {
      continue;
    }

    const first = words.slice(0, size).join(" ").toLowerCase();
    const second = words.slice(size, size * 2).join(" ").toLowerCase();
    if (first === second) {
      return words.slice(size).join(" ");
    }
  }

  return normalized;
}

function splitSpeechText(text) {
  const normalized = normalizeSpeechText(text);
  if (!normalized) {
    return [];
  }

  const platform = getSpeechPlatform();
  const maxChunkLength = platform.isIOS && platform.isSafari ? 68 : 110;
  const sentenceChunks = normalized
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const finalChunks = [];
  for (const sentence of sentenceChunks) {
    if (sentence.length <= maxChunkLength) {
      finalChunks.push(sentence);
      continue;
    }

    const clauses = sentence
      .split(/(?<=[,;:])\s+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    let currentChunk = "";
    for (const clause of clauses) {
      const nextChunk = currentChunk ? `${currentChunk} ${clause}` : clause;
      if (nextChunk.length > maxChunkLength && currentChunk) {
        finalChunks.push(currentChunk);
        currentChunk = clause;
      } else {
        currentChunk = nextChunk;
      }
    }

    if (currentChunk) {
      if (currentChunk.length <= maxChunkLength) {
        finalChunks.push(currentChunk);
        continue;
      }

      const words = currentChunk.split(/\s+/).filter(Boolean);
      let wordChunk = "";
      for (const word of words) {
        const nextWordChunk = wordChunk ? `${wordChunk} ${word}` : word;
        if (nextWordChunk.length > maxChunkLength && wordChunk) {
          finalChunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = nextWordChunk;
        }
      }

      if (wordChunk) {
        finalChunks.push(wordChunk);
      }
    }
  }

  return finalChunks;
}

function getSpeechProfile(voice, options, platform) {
  const voiceName = voice?.name?.toLowerCase() || "";
  const { isIOS, isSafari, isChrome } = platform || {};
  const isAppleNatural =
    voiceName.includes("siri") ||
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
  const isIOSSafari = isIOS && isSafari;

  return {
    rate:
      options.rate ??
      (isIOSSafari
        ? isAppleNatural
          ? 0.82
          : 0.8
        : isAppleNatural
        ? 0.86
        : isGoogleNatural
        ? isChrome
          ? 0.87
          : 0.86
        : isMicrosoftNatural
        ? 0.86
        : isLegacyVoice
        ? 0.83
        : 0.88),
    pitch:
      options.pitch ??
      (isIOSSafari
        ? isAppleNatural
          ? 1
          : 0.98
        : isAppleNatural
        ? 0.98
        : isGoogleNatural
        ? 0.97
        : isLegacyVoice
        ? 0.92
        : 0.96),
    volume: options.volume ?? (isIOSSafari ? 1 : undefined),
    preDelayMs: options.preDelayMs ?? (isIOSSafari ? 80 : 0),
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
  const [audioUnlocked, setAudioUnlocked] = useState(() => isUiAudioUnlocked());
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
  const voicesReadyRef = useRef(false);
  const platformRef = useRef(getSpeechPlatform());
  const voicesPromiseRef = useRef(null);
  const lockedVoiceNameRef = useRef("");
  const lastGesturePrimeAtRef = useRef(0);

  useEffect(() => subscribeUiAudioUnlock(setAudioUnlocked), []);

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

  const rememberPendingSequence = useCallback((sequence, options = {}) => {
    if (!sequence?.items?.length) {
      pendingSpeakRef.current = null;
      return;
    }

    pendingSpeakRef.current = {
      type: "sequence",
      items: sequence.items.map((item) => ({ ...item })),
      options: {
        key: sequence.key,
        pauseAfterMs: sequence.pauseAfterMs ?? 0,
        priority: sequence.priority ?? 1,
        fallbackTried: sequence.fallbackTried ?? false,
        interrupt: true,
        minGapMs: 0,
        ...options,
      },
    };
  }, []);

  const ensureVoicesReady = useCallback(() => {
    if (!canUseSpeechSynthesis()) {
      return Promise.resolve([]);
    }

    const existingVoices = window.speechSynthesis.getVoices();
    if (existingVoices.length > 0) {
      voicesReadyRef.current = true;
      const selectedVoice = pickAmericanVoice(existingVoices, platformRef.current, {
        lockedVoiceName: lockedVoiceNameRef.current,
      });
      if (selectedVoice?.name) {
        lockedVoiceNameRef.current = selectedVoice.name;
      }
      setVoice(selectedVoice);
      setStatus((current) => (current === "unsupported" ? current : "ready"));
      return Promise.resolve(existingVoices);
    }

    if (voicesPromiseRef.current) {
      return voicesPromiseRef.current;
    }

    voicesPromiseRef.current = new Promise((resolve) => {
      let resolved = false;
      let retryTimer = null;
      let retries = 0;

      const finish = (voices) => {
        if (resolved) {
          return;
        }
        resolved = true;
        if (retryTimer) {
          window.clearTimeout(retryTimer);
        }
        window.speechSynthesis.removeEventListener("voiceschanged", assignVoice);
        voicesPromiseRef.current = null;
        resolve(voices);
      };

      const assignVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesReadyRef.current = true;
          const selectedVoice = pickAmericanVoice(voices, platformRef.current, {
            lockedVoiceName: lockedVoiceNameRef.current,
          });
          if (selectedVoice?.name) {
            lockedVoiceNameRef.current = selectedVoice.name;
          }
          setVoice(selectedVoice);
          setStatus((current) => (current === "unsupported" ? current : "ready"));
          finish(voices);
          return true;
        }

        if (retries < 12) {
          retries += 1;
          retryTimer = window.setTimeout(assignVoice, 200);
          return false;
        }

        finish([]);
        return false;
      };

      window.speechSynthesis.addEventListener("voiceschanged", assignVoice);
      assignVoice();
    });

    return voicesPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!canUseSpeechSynthesis()) return undefined;
    platformRef.current = getSpeechPlatform();
    void ensureVoicesReady();
    return undefined;
  }, [ensureVoicesReady]);

  const runSequence = useCallback(
    async (sequence, token = sequenceTokenRef.current) => {
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

      if (!voicesReadyRef.current) {
        await ensureVoicesReady();
        if (token !== sequenceTokenRef.current) {
          return false;
        }
      }

      try {
        window.speechSynthesis.resume?.();
      } catch {
        // Ignore resume failures and keep going.
      }

      const utterance = new SpeechSynthesisUtterance(nextItem.text);
      const profile = getSpeechProfile(voice, nextItem, platformRef.current);
      if (voice && !sequence.useSystemVoice) {
        utterance.voice = voice;
      }
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume ?? settings.volume;
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
          void runSequence(nextSequence, token);
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
          isPrimedRef.current = false;
          rememberPendingSequence(sequence);
          setStatus("waiting_for_gesture");
          return;
        }

        if (voice && !sequence.fallbackTried) {
          const availableVoices = window.speechSynthesis.getVoices();
          const alternateVoice = pickAmericanVoice(availableVoices, platformRef.current, {
            excludeNames: [voice?.name],
          });

          if (alternateVoice) {
            if (alternateVoice?.name) {
              lockedVoiceNameRef.current = alternateVoice.name;
            }
            setVoice(alternateVoice);
            utteranceRef.current = null;
            currentSequenceRef.current = null;
            clearStepTimer();
            sequenceTokenRef.current += 1;
            return void runSequence(
              {
                ...sequence,
                fallbackTried: true,
              },
              sequenceTokenRef.current
            );
          }
        }

        utteranceRef.current = null;
        currentSequenceRef.current = null;
        queuedSequencesRef.current = [];
        setStatus("blocked");
      };

      try {
        if (profile.preDelayMs > 0) {
          await new Promise((resolve) => {
            stepTimerRef.current = window.setTimeout(resolve, profile.preDelayMs);
          });
          if (token !== sequenceTokenRef.current) {
            return false;
          }
        }

        window.speechSynthesis.speak(utterance);
      } catch {
        setStatus("blocked");
        return false;
      }

      return true;
    },
    [clearStepTimer, ensureVoicesReady, rememberPendingSequence, settings.volume, voice]
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
        .flatMap((item) => {
          const normalizedItem =
            typeof item === "string"
              ? { text: item, pauseAfterMs: options.pauseAfterMs ?? 0 }
              : {
                  ...item,
                  text: item?.text || "",
                };
          const dedupedText = dedupeRepeatedLeadPhrase(normalizedItem.text);
          const chunks = splitSpeechText(dedupedText);
          if (!chunks.length) {
            return [];
          }

          return chunks.map((chunk, index) => ({
            ...normalizedItem,
            text: chunk,
            pauseAfterMs:
              index === chunks.length - 1
                ? normalizedItem.pauseAfterMs
                : Math.max(
                    platformRef.current.isIOS && platformRef.current.isSafari ? 180 : 120,
                    Math.min(
                      platformRef.current.isIOS && platformRef.current.isSafari ? 280 : 220,
                      normalizedItem.pauseAfterMs ?? (platformRef.current.isIOS && platformRef.current.isSafari ? 210 : 160)
                    )
                  ),
          }));
        })
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
        pendingSpeakRef.current = {
          type: "sequence",
          items,
          options,
        };
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
        void runSequence(request, sequenceTokenRef.current);
        return true;
      }

      const currentPriority = currentSequenceRef.current?.priority ?? 1;
      if (options.interrupt === true || request.priority > currentPriority) {
        clearStepTimer();
        queuedSequencesRef.current = [];
        sequenceTokenRef.current += 1;
        const nextToken = sequenceTokenRef.current;
        window.speechSynthesis.cancel();
        stepTimerRef.current = window.setTimeout(() => {
          if (nextToken !== sequenceTokenRef.current) {
            return;
          }
          try {
            window.speechSynthesis.resume?.();
          } catch {
            // Ignore resume failures after interrupt.
          }
          void runSequence(request, nextToken);
        }, platformRef.current.isIOS && platformRef.current.isSafari ? 140 : 75);
        return true;
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

  const prime = useCallback((options = {}) => {
    if (!canUseSpeechSynthesis()) {
      setStatus("unsupported");
      return false;
    }

    const userGesture = Boolean(options.userGesture);

    try {
      void ensureVoicesReady();
      window.speechSynthesis.resume?.();

      const unlocked = Boolean(userGesture || isUiAudioUnlocked());
      isPrimedRef.current = unlocked;
      setStatus(unlocked ? "ready" : "waiting_for_gesture");

      if (unlocked && pendingSpeakRef.current) {
        const nextPending = pendingSpeakRef.current;
        pendingSpeakRef.current = null;
        if (nextPending.type === "sequence") {
          queueSequence(nextPending.items, {
            ...nextPending.options,
            userGesture,
            minGapMs: 0,
          });
        } else {
          queueSequence([{ text: nextPending.text }], {
            ...nextPending.options,
            userGesture,
            minGapMs: 0,
          });
        }
      }

      return unlocked;
    } catch {
      setStatus("blocked");
      return false;
    }
  }, [ensureVoicesReady, queueSequence]);

  useEffect(() => {
    if (!canUseSpeechSynthesis()) return undefined;

    const primeFromGesture = () => {
      const now = Date.now();
      if (now - lastGesturePrimeAtRef.current < 320) {
        return;
      }

      if (
        !isPrimedRef.current ||
        Boolean(pendingSpeakRef.current) ||
        status === "waiting_for_gesture"
      ) {
        lastGesturePrimeAtRef.current = now;
        prime({ userGesture: true });
      }
    };

    window.addEventListener("pointerup", primeFromGesture);
    window.addEventListener("click", primeFromGesture);
    window.addEventListener("keydown", primeFromGesture);
    window.addEventListener("touchend", primeFromGesture);

    return () => {
      window.removeEventListener("pointerup", primeFromGesture);
      window.removeEventListener("click", primeFromGesture);
      window.removeEventListener("keydown", primeFromGesture);
      window.removeEventListener("touchend", primeFromGesture);
    };
  }, [prime, status]);

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
        pendingSpeakRef.current = {
          type: "sequence",
          items: [{ text }],
          options,
        };
        setStatus("waiting_for_gesture");
        return false;
      }

      return queueSequence([{ text }], options);
    },
    [queueSequence]
  );

  const speakSequence = useCallback(
    (items, options = {}) => {
      if (!options.userGesture && !isPrimedRef.current) {
        pendingSpeakRef.current = {
          type: "sequence",
          items,
          options,
        };
      }

      return queueSequence(items, options);
    },
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
    audioUnlocked,
    cloudTtsRecommended:
      platformRef.current.isIOS && platformRef.current.isSafari && !voice?.name,
  };
}
