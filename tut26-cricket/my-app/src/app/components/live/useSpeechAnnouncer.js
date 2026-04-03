"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isUiAudioUnlocked,
  restorePreferredAudioSessionType,
  setPreferredAudioSessionType,
  subscribeUiAudioUnlock,
} from "../../lib/page-audio";

const SPEECH_DEBUG_PREFIX = "[GV Speech]";
const CHROME_PREFERRED_VOICE_NAMES = [
  "microsoft jenny online (natural)",
  "microsoft jenny online",
  "microsoft jenny",
  "google uk english female",
  "google us english",
  "google english",
];
const NON_SAFARI_PREFERRED_VOICE_NAMES = [
  "microsoft jenny online (natural)",
  "microsoft jenny online",
  "microsoft jenny",
];
const NON_SAFARI_FALLBACK_VOICE_NAMES = [
  "google uk english female",
  "microsoft aria online (natural)",
  "microsoft aria online",
  "microsoft aria",
  "google us english",
  "google english",
];
const NATURAL_VOICE_KEYWORDS = ["enhanced", "premium", "natural", "neural"];
const FEMALE_VOICE_KEYWORDS = [
  "female",
  "samantha",
  "ava",
  "allison",
  "nicky",
  "aria",
  "jenny",
  "siri",
];
const MALE_VOICE_KEYWORDS = ["male", "guy", "david", "mark", "fred"];

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
    (window.navigator?.platform === "MacIntel" &&
      window.navigator?.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|EdgiOS|FxiOS|OPiOS/i.test(userAgent) &&
    /Apple/i.test(vendor);
  const isChrome = /Chrome|CriOS/i.test(userAgent);

  return { isIOS, isSafari, isChrome };
}

function normalizeVoiceLang(voice) {
  return String(voice?.lang || "")
    .trim()
    .toLowerCase();
}

function describeVoice(voice) {
  return {
    name: String(voice?.name || ""),
    lang: String(voice?.lang || ""),
    default: Boolean(voice?.default),
    localService: Boolean(voice?.localService),
    voiceURI: String(voice?.voiceURI || ""),
  };
}

function getVoicesSignature(voices) {
  return voices
    .map((voice) =>
      [
        String(voice?.name || ""),
        String(voice?.lang || ""),
        voice?.default ? "1" : "0",
        voice?.localService ? "1" : "0",
        String(voice?.voiceURI || ""),
      ].join(":"),
    )
    .join("|");
}

function logAvailableVoices(voices, selectedVoice = null) {
  const voiceSummaries = voices.map(describeVoice);
  const foundSamantha = voices.some((voice) => {
    const voiceName = String(voice?.name || "").toLowerCase();
    return (
      voiceName.includes("samantha") && normalizeVoiceLang(voice) === "en-us"
    );
  });

  console.info(`${SPEECH_DEBUG_PREFIX} total voices`, voices.length);
  console.info(`${SPEECH_DEBUG_PREFIX} Samantha found`, foundSamantha);
  console.info(
    `${SPEECH_DEBUG_PREFIX} selected voice`,
    selectedVoice ? selectedVoice.name : "(none)",
  );
  console.table(voiceSummaries);
}

function getSamanthaVoiceRank(voice) {
  const searchableValue = [
    String(voice?.name || "").toLowerCase(),
    String(voice?.voiceURI || "").toLowerCase(),
  ].join(" ");

  let score = 0;

  if (searchableValue.includes("enhanced")) {
    score += 500;
  }
  if (searchableValue.includes("premium")) {
    score += 350;
  }
  if (searchableValue.includes("natural")) {
    score += 260;
  }
  if (voice?.localService) {
    score += 40;
  }
  if (voice?.default) {
    score += 20;
  }
  if (searchableValue.includes("compact")) {
    score -= 120;
  }

  return score;
}

function getAppleNaturalVoiceRank(voice) {
  const searchableValue = [
    String(voice?.name || "").toLowerCase(),
    String(voice?.voiceURI || "").toLowerCase(),
  ].join(" ");

  let score = 0;

  if (normalizeVoiceLang(voice) === "en-us") {
    score += 240;
  } else if (normalizeVoiceLang(voice).startsWith("en")) {
    score += 120;
  }

  if (searchableValue.includes("siri voice 4")) {
    score += 460;
  } else if (searchableValue.includes("siri")) {
    score += 300;
  } else if (searchableValue.includes("samantha")) {
    score += 240;
  } else if (searchableValue.includes("ava")) {
    score += 220;
  } else if (searchableValue.includes("allison")) {
    score += 210;
  } else if (searchableValue.includes("nicky")) {
    score += 180;
  }

  if (searchableValue.includes("enhanced")) {
    score += 420;
  }
  if (searchableValue.includes("premium")) {
    score += 280;
  }
  if (searchableValue.includes("natural")) {
    score += 220;
  }
  if (voice?.localService) {
    score += 40;
  }
  if (voice?.default) {
    score += 16;
  }
  if (searchableValue.includes("compact")) {
    score -= 180;
  }

  return score;
}

function pickPreferredVoiceByName(voices, preferredNames) {
  for (const preferredName of preferredNames) {
    const found = voices.find((voice) =>
      String(voice?.name || "")
        .toLowerCase()
        .includes(preferredName),
    );
    if (found) {
      return found;
    }
  }

  return null;
}

function getNaturalFemaleVoiceRank(voice) {
  const searchableValue = [
    String(voice?.name || "").toLowerCase(),
    String(voice?.voiceURI || "").toLowerCase(),
  ].join(" ");

  let score = 0;

  for (const keyword of NATURAL_VOICE_KEYWORDS) {
    if (searchableValue.includes(keyword)) {
      score += 220;
      break;
    }
  }

  if (
    FEMALE_VOICE_KEYWORDS.some((keyword) => searchableValue.includes(keyword))
  ) {
    score += 180;
  }

  if (normalizeVoiceLang(voice) === "en-us") {
    score += 140;
  } else if (normalizeVoiceLang(voice).startsWith("en")) {
    score += 70;
  }

  if (voice?.localService) {
    score += 60;
  }
  if (voice?.default) {
    score += 20;
  }
  if (searchableValue.includes("zira")) {
    score -= 320;
  }
  if (searchableValue.includes("david")) {
    score -= 180;
  }
  if (searchableValue.includes("mark")) {
    score -= 140;
  }
  if (searchableValue.includes("guy")) {
    score -= 80;
  }
  if (searchableValue.includes("compact")) {
    score -= 120;
  }
  if (
    MALE_VOICE_KEYWORDS.some((keyword) => searchableValue.includes(keyword))
  ) {
    score -= 200;
  }

  return score;
}

function selectBestSamanthaVoice(voices) {
  const samanthaVoices = voices.filter((voice) => {
    const voiceName = String(voice?.name || "").toLowerCase();
    return (
      voiceName.includes("samantha") && normalizeVoiceLang(voice) === "en-us"
    );
  });

  if (!samanthaVoices.length) {
    return null;
  }

  return [...samanthaVoices].sort(
    (left, right) => getSamanthaVoiceRank(right) - getSamanthaVoiceRank(left),
  )[0];
}

function selectBestAppleNaturalVoice(voices) {
  const matchingVoices = voices.filter((voice) => {
    const searchableValue = [
      String(voice?.name || "").toLowerCase(),
      String(voice?.voiceURI || "").toLowerCase(),
    ].join(" ");

    return (
      normalizeVoiceLang(voice).startsWith("en") &&
      (searchableValue.includes("siri") ||
        searchableValue.includes("samantha") ||
        searchableValue.includes("ava") ||
        searchableValue.includes("allison") ||
        searchableValue.includes("nicky"))
    );
  });

  if (!matchingVoices.length) {
    return null;
  }

  return [...matchingVoices].sort(
    (left, right) =>
      getAppleNaturalVoiceRank(right) - getAppleNaturalVoiceRank(left),
  )[0];
}

function selectBestNaturalFemaleVoice(voices, langPrefix = "en-us") {
  const matchingVoices = voices.filter((voice) =>
    normalizeVoiceLang(voice).startsWith(langPrefix),
  );

  if (!matchingVoices.length) {
    return null;
  }

  return [...matchingVoices].sort(
    (left, right) =>
      getNaturalFemaleVoiceRank(right) - getNaturalFemaleVoiceRank(left),
  )[0];
}

function selectPreferredVoice(voices, options = {}) {
  const platform = options.platform || {};
  const excludedUris = new Set(
    (options.excludeVoiceUris || []).map((value) => String(value || "")),
  );
  const excludedNames = new Set(
    (options.excludeVoiceNames || []).map((value) =>
      String(value || "").toLowerCase(),
    ),
  );
  const availableVoices = voices.filter(
    (voice) =>
      !excludedUris.has(String(voice?.voiceURI || "")) &&
      !excludedNames.has(String(voice?.name || "").toLowerCase()),
  );

  if (!availableVoices.length) {
    return null;
  }

  if (platform.isIOS && platform.isSafari) {
    const samanthaVoice = selectBestSamanthaVoice(availableVoices);
    const samanthaSearchValue = [
      String(samanthaVoice?.name || "").toLowerCase(),
      String(samanthaVoice?.voiceURI || "").toLowerCase(),
    ].join(" ");
    const hasEnhancedSamantha = Boolean(
      samanthaVoice &&
        (samanthaSearchValue.includes("enhanced") ||
          samanthaSearchValue.includes("premium") ||
          samanthaSearchValue.includes("natural")),
    );

    if (hasEnhancedSamantha) {
      return samanthaVoice;
    }

    const bestAppleNaturalVoice = selectBestAppleNaturalVoice(availableVoices);
    if (bestAppleNaturalVoice) {
      return bestAppleNaturalVoice;
    }

    if (samanthaVoice) {
      return samanthaVoice;
    }

    const localEnUsVoice =
      availableVoices.find(
        (voice) =>
          normalizeVoiceLang(voice) === "en-us" && voice?.localService === true,
      ) || null;

    if (localEnUsVoice) {
      return localEnUsVoice;
    }

    const anyEnUsVoice =
      availableVoices.find((voice) => normalizeVoiceLang(voice) === "en-us") ||
      null;

    if (anyEnUsVoice) {
      return anyEnUsVoice;
    }

    return availableVoices[0] || null;
  }

  const preferredNonSafariVoice = pickPreferredVoiceByName(
    availableVoices,
    NON_SAFARI_PREFERRED_VOICE_NAMES,
  );
  if (preferredNonSafariVoice) {
    return preferredNonSafariVoice;
  }

  const preferredNonSafariFallbackVoice = pickPreferredVoiceByName(
    availableVoices,
    NON_SAFARI_FALLBACK_VOICE_NAMES,
  );
  if (preferredNonSafariFallbackVoice) {
    return preferredNonSafariFallbackVoice;
  }

  if (platform.isChrome) {
    const preferredChromeVoice = pickPreferredVoiceByName(
      availableVoices,
      CHROME_PREFERRED_VOICE_NAMES,
    );
    if (preferredChromeVoice) {
      return preferredChromeVoice;
    }
  }

  const naturalFemaleEnUsVoice = selectBestNaturalFemaleVoice(
    availableVoices,
    "en-us",
  );
  if (naturalFemaleEnUsVoice) {
    return naturalFemaleEnUsVoice;
  }

  const naturalFemaleEnglishVoice = selectBestNaturalFemaleVoice(
    availableVoices,
    "en",
  );
  if (naturalFemaleEnglishVoice) {
    return naturalFemaleEnglishVoice;
  }

  const anyEnUsVoice =
    availableVoices.find((voice) => normalizeVoiceLang(voice) === "en-us") ||
    null;

  if (anyEnUsVoice) {
    return anyEnUsVoice;
  }

  return availableVoices[0] || null;
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
    const second = words
      .slice(size, size * 2)
      .join(" ")
      .toLowerCase();
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
  const voiceName = String(voice?.name || "").toLowerCase();
  const isIOSSafari = Boolean(platform?.isIOS && platform?.isSafari);
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
  const isLegacyVoice =
    voiceName.includes("zira") || voiceName.includes("david");

  const defaultRate = isIOSSafari
    ? isAppleNatural
      ? 0.8
      : 0.79
    : isAppleNatural
      ? 0.84
      : isGoogleNatural
        ? platform?.isChrome
          ? 0.82
          : 0.84
        : isMicrosoftNatural
          ? 0.84
          : isLegacyVoice
            ? 0.82
            : 0.86;

  const defaultPitch = isIOSSafari
    ? 1
    : isAppleNatural
      ? 1
      : isGoogleNatural
        ? 0.97
        : isLegacyVoice
          ? 0.94
          : 0.98;
  const requestedRate = Number(options.rate);
  const safeRequestedRate = Number.isFinite(requestedRate)
    ? requestedRate
    : null;
  const maxRate = isIOSSafari
    ? 0.8
    : isGoogleNatural
      ? 0.82
      : isMicrosoftNatural
        ? 0.84
        : isAppleNatural
          ? 0.84
          : isLegacyVoice
            ? 0.82
            : 0.86;
  const effectiveRate =
    safeRequestedRate === null
      ? defaultRate
      : Math.min(safeRequestedRate, maxRate);

  return {
    rate: effectiveRate || defaultRate,
    pitch: Number(options.pitch ?? defaultPitch) || defaultPitch,
    volume: Number(options.volume ?? 1) || 1,
    preDelayMs: options.preDelayMs ?? (isIOSSafari ? 60 : 0),
  };
}

function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}

function normalizeSpeechError(error) {
  const value = String(error || "").toLowerCase();
  if (value.includes("not-allowed")) return "not-allowed";
  if (value.includes("interrupted")) return "interrupted";
  if (value.includes("canceled") || value.includes("cancelled"))
    return "canceled";
  return value;
}

export default function useSpeechAnnouncer(settings) {
  const [platformState, setPlatformState] = useState(() => getSpeechPlatform());
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
  const platformRef = useRef(platformState);
  const voicesPromiseRef = useRef(null);
  const selectedVoiceRef = useRef(null);
  const loggedVoicesSignatureRef = useRef("");
  const audioSessionTypeRef = useRef("");
  const announcerEnabled = Boolean(
    settings?.enabled && !settings?.muted && settings?.mode !== "silent",
  );

  useEffect(() => subscribeUiAudioUnlock(setAudioUnlocked), []);

  const clearStepTimer = useCallback(() => {
    if (stepTimerRef.current) {
      window.clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  const ensureSpeechAudioSession = useCallback(() => {
    const previousType = setPreferredAudioSessionType("playback") || "";
    if (!audioSessionTypeRef.current) {
      audioSessionTypeRef.current = previousType;
    }
  }, []);

  const restoreSpeechAudioSession = useCallback(() => {
    if (!audioSessionTypeRef.current) {
      return;
    }

    restorePreferredAudioSessionType(audioSessionTypeRef.current);
    audioSessionTypeRef.current = "";
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

    restoreSpeechAudioSession();
    setStatus((current) => (current === "unsupported" ? current : "ready"));
  }, [clearStepTimer, restoreSpeechAudioSession]);

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

  const syncVoiceSelection = useCallback((voices) => {
    const safeVoices = Array.isArray(voices) ? voices.filter(Boolean) : [];
    const selectedVoice = selectPreferredVoice(safeVoices, {
      platform: platformRef.current,
    });
    const signature = getVoicesSignature(safeVoices);

    if (signature && loggedVoicesSignatureRef.current !== signature) {
      logAvailableVoices(safeVoices, selectedVoice);
      loggedVoicesSignatureRef.current = signature;
    }

    selectedVoiceRef.current = selectedVoice || null;
    setVoice(selectedVoice || null);
    setStatus((current) => (current === "unsupported" ? current : "ready"));
    return selectedVoice;
  }, []);

  const ensureVoicesReady = useCallback(() => {
    if (!canUseSpeechSynthesis()) {
      return Promise.resolve([]);
    }

    const existingVoices = window.speechSynthesis.getVoices();
    if (existingVoices.length > 0) {
      voicesReadyRef.current = true;
      syncVoiceSelection(existingVoices);
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
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          assignVoice,
        );
        voicesPromiseRef.current = null;
        resolve(voices);
      };

      const assignVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesReadyRef.current = true;
          syncVoiceSelection(voices);
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
  }, [syncVoiceSelection]);

  useEffect(() => {
    if (!canUseSpeechSynthesis()) {
      return undefined;
    }

    const detectedPlatform = getSpeechPlatform();
    platformRef.current = detectedPlatform;
    setPlatformState(detectedPlatform);
    return undefined;
  }, []);

  useEffect(() => {
    if (!voice) {
      return;
    }

    console.info(`${SPEECH_DEBUG_PREFIX} selected voice`, voice.name);
  }, [voice]);

  const shouldPrepareVoices =
    announcerEnabled || status === "waiting_for_gesture";
  const requiresDirectUserGesture =
    platformState.isIOS && platformState.isSafari;

  useEffect(() => {
    if (!shouldPrepareVoices) {
      return undefined;
    }

    void ensureVoicesReady();
    return undefined;
  }, [ensureVoicesReady, shouldPrepareVoices]);

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
          return runSequence(
            { ...pending, index: 0 },
            sequenceTokenRef.current,
          );
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

      const selectedVoice = selectedVoiceRef.current || voice || null;
      const utterance = new SpeechSynthesisUtterance(nextItem.text);
      const profile = getSpeechProfile(
        selectedVoice,
        nextItem,
        platformRef.current,
      );
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.lang = selectedVoice?.lang || "en-US";
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume;
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
        restoreSpeechAudioSession();
        const pauseAfterMs =
          nextItem.pauseAfterMs ?? sequence.pauseAfterMs ?? 0;
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
          restoreSpeechAudioSession();
          setStatus((current) =>
            current === "unsupported" ? current : "ready",
          );
          return;
        }

        if (errorType === "not-allowed") {
          utteranceRef.current = null;
          currentSequenceRef.current = null;
          queuedSequencesRef.current = [];
          isPrimedRef.current = false;
          restoreSpeechAudioSession();
          rememberPendingSequence(sequence);
          setStatus("waiting_for_gesture");
          return;
        }

        if (selectedVoice && !sequence.fallbackTried) {
          const availableVoices = window.speechSynthesis.getVoices();
          const alternateVoice = selectPreferredVoice(availableVoices, {
            platform: platformRef.current,
            excludeVoiceUris: [selectedVoice?.voiceURI],
            excludeVoiceNames: [selectedVoice?.name],
          });

          if (alternateVoice) {
            selectedVoiceRef.current = alternateVoice;
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
              sequenceTokenRef.current,
            );
          }
        }

        utteranceRef.current = null;
        currentSequenceRef.current = null;
        queuedSequencesRef.current = [];
        restoreSpeechAudioSession();
        setStatus("blocked");
      };

      try {
        if (profile.preDelayMs > 0) {
          await new Promise((resolve) => {
            stepTimerRef.current = window.setTimeout(
              resolve,
              profile.preDelayMs,
            );
          });
          if (token !== sequenceTokenRef.current) {
            return false;
          }
        }

        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        ensureSpeechAudioSession();
        window.speechSynthesis.speak(utterance);
      } catch {
        restoreSpeechAudioSession();
        setStatus("blocked");
        return false;
      }

      return true;
    },
    [
      clearStepTimer,
      ensureSpeechAudioSession,
      ensureVoicesReady,
      rememberPendingSequence,
      restoreSpeechAudioSession,
      voice,
    ],
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
                    platformRef.current.isIOS && platformRef.current.isSafari
                      ? 180
                      : 120,
                    Math.min(
                      platformRef.current.isIOS && platformRef.current.isSafari
                        ? 280
                        : 220,
                      normalizedItem.pauseAfterMs ??
                        (platformRef.current.isIOS &&
                        platformRef.current.isSafari
                          ? 210
                          : 160),
                    ),
                  ),
          }));
        })
        .filter((item) => item.text);

      if (!normalizedItems.length) {
        return false;
      }

      const key =
        options.key || normalizedItems.map((item) => item.text).join("|");
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
        stepTimerRef.current = window.setTimeout(
          () => {
            if (nextToken !== sequenceTokenRef.current) {
              return;
            }
            try {
              window.speechSynthesis.resume?.();
            } catch {
              // Ignore resume failures after interrupt.
            }
            void runSequence(request, nextToken);
          },
          platformRef.current.isIOS && platformRef.current.isSafari ? 140 : 75,
        );
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
    ],
  );

  const prime = useCallback(
    (options = {}) => {
      if (!canUseSpeechSynthesis()) {
        setStatus("unsupported");
        return false;
      }

      const userGesture = Boolean(options.userGesture);

      try {
        void ensureVoicesReady();
        window.speechSynthesis.resume?.();

        const unlocked = Boolean(
          userGesture || (!requiresDirectUserGesture && isUiAudioUnlocked()),
        );
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
    },
    [ensureVoicesReady, queueSequence, requiresDirectUserGesture],
  );

  useEffect(() => {
    if (
      requiresDirectUserGesture ||
      !audioUnlocked ||
      isPrimedRef.current ||
      status === "unsupported" ||
      (!announcerEnabled && status !== "waiting_for_gesture")
    ) {
      return;
    }

    prime();
  }, [
    announcerEnabled,
    audioUnlocked,
    prime,
    requiresDirectUserGesture,
    status,
  ]);

  useEffect(() => {
    if (
      requiresDirectUserGesture ||
      !canUseSpeechSynthesis() ||
      status !== "waiting_for_gesture"
    ) {
      return undefined;
    }

    const primeFromGesture = () => {
      if (
        !isPrimedRef.current ||
        Boolean(pendingSpeakRef.current) ||
        status === "waiting_for_gesture"
      ) {
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
  }, [prime, requiresDirectUserGesture, status]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    if (status !== "speaking" && status !== "waiting_for_gesture") {
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
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

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
    [queueSequence],
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
    [queueSequence],
  );

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    pendingSpeakRef.current = null;
    hardStop();
  }, [hardStop]);

  const interruptAndCapture = useCallback(() => {
    const captured = [];

    if (currentSequenceRef.current?.items?.length) {
      const currentSequence = currentSequenceRef.current;
      const remainingItems = currentSequence.items
        .slice(Math.max(0, currentSequence.index || 0))
        .map((item) => ({ ...item }));

      if (remainingItems.length) {
        captured.push({
          items: remainingItems,
          options: {
            key: currentSequence.key
              ? `${currentSequence.key}:resume`
              : `resume-${Date.now()}`,
            priority: currentSequence.priority ?? 1,
            pauseAfterMs: currentSequence.pauseAfterMs ?? 0,
            interrupt: true,
            minGapMs: 0,
          },
        });
      }
    }

    for (const queued of queuedSequencesRef.current) {
      if (!queued?.items?.length) {
        continue;
      }

      captured.push({
        items: queued.items.map((item) => ({ ...item })),
        options: {
          key: queued.key
            ? `${queued.key}:resume`
            : `queued-resume-${Date.now()}`,
          priority: queued.priority ?? 1,
          pauseAfterMs: queued.pauseAfterMs ?? 0,
          interrupt: false,
          minGapMs: 0,
        },
      });
    }

    if (
      pendingSpeakRef.current?.type === "sequence" &&
      pendingSpeakRef.current.items?.length
    ) {
      captured.push({
        items: pendingSpeakRef.current.items.map((item) =>
          typeof item === "string" ? { text: item } : { ...item },
        ),
        options: {
          ...(pendingSpeakRef.current.options || {}),
          key: pendingSpeakRef.current.options?.key
            ? `${pendingSpeakRef.current.options.key}:resume`
            : `pending-resume-${Date.now()}`,
          interrupt: false,
          minGapMs: 0,
        },
      });
    }

    if (!captured.length) {
      return [];
    }

    pendingSpeakRef.current = null;
    hardStop();
    return captured;
  }, [hardStop]);

  useEffect(() => () => hardStop(), [hardStop]);

  return {
    speak,
    speakSequence,
    prime,
    stop,
    isSupported: status !== "unsupported",
    isSpeaking: status === "speaking",
    interruptAndCapture,
    needsGesture: status === "waiting_for_gesture",
    status,
    voiceName: voice?.name || "",
    audioUnlocked,
    cloudTtsRecommended:
      platformRef.current.isIOS && platformRef.current.isSafari && !voice?.name,
  };
}
