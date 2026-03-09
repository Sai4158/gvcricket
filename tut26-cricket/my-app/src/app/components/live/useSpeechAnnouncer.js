"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickAmericanVoice(voices) {
  const preferredNames = [
    "Google US English",
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

function playAccessibilityChime(volume) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(Math.max(0.02, volume * 0.08), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
}

export default function useSpeechAnnouncer(settings) {
  const [voice, setVoice] = useState(null);
  const lastSpokenRef = useRef({ key: "", at: 0 });

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;

    const assignVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoice(pickAmericanVoice(voices));
    };

    assignVoice();
    window.speechSynthesis.addEventListener("voiceschanged", assignVoice);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", assignVoice);
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (
      !text ||
      !settings.enabled ||
      settings.muted ||
      settings.mode === "silent" ||
      typeof window === "undefined" ||
      !window.speechSynthesis
    ) {
      return;
    }

    const key = options.key || text;
    const now = Date.now();
    const minGap = options.minGapMs ?? 450;
    if (
      lastSpokenRef.current.key === key &&
      now - lastSpokenRef.current.at < minGap
    ) {
      return;
    }

    lastSpokenRef.current = { key, at: now };

    if (options.interrupt !== false) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);

    if (settings.accessibilityMode) {
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 70]);
      }
      playAccessibilityChime(settings.volume);
    }
  }, [settings.accessibilityMode, settings.enabled, settings.mode, settings.muted, settings.volume, voice]);

  return { speak };
}
