"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedAudioAssetUrl,
  isIOSSafari,
  isUiAudioUnlocked,
  playBufferedUiAudio,
  primeUiAudio,
  subscribeUiAudioUnlock,
} from "../../lib/page-audio";

export default function useLiveSoundEffectsPlayer({
  volume = 1,
  onBeforePlay,
  onAfterEnd,
} = {}) {
  const audioRef = useRef(null);
  const bufferedPlaybackRef = useRef(null);
  const playRequestRef = useRef(0);
  const resolvedSrcByEffectRef = useRef(new Map());
  const isIosSafari = useMemo(() => isIOSSafari(), []);
  const [activeEffectId, setActiveEffectId] = useState("");
  const [status, setStatus] = useState("idle");
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(isUiAudioUnlocked());

  const resetPlaybackState = useCallback(() => {
    setActiveEffectId("");
    setStatus("idle");
  }, []);

  useEffect(() => {
    return subscribeUiAudioUnlock((nextValue) => {
      setAudioUnlocked(Boolean(nextValue));
      if (nextValue) {
        setNeedsUnlock(false);
      }
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleEnded = () => {
      bufferedPlaybackRef.current = null;
      resetPlaybackState();
      onAfterEnd?.();
    };

    const handlePlaying = () => {
      setStatus("playing");
    };

    const handleError = () => {
      bufferedPlaybackRef.current = null;
      resetPlaybackState();
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("error", handleError);
    };
  }, [onAfterEnd, resetPlaybackState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  const stop = useCallback(
    ({ clearSource = true, preserveRequest = false } = {}) => {
      if (!preserveRequest) {
        playRequestRef.current += 1;
      }

      if (bufferedPlaybackRef.current) {
        bufferedPlaybackRef.current.stop();
        bufferedPlaybackRef.current = null;
      }

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore currentTime reset failures on stubborn browsers.
        }

        if (clearSource) {
          audio.removeAttribute("src");
          audio.load();
        }
      }

      resetPlaybackState();
    },
    [resetPlaybackState],
  );

  const prime = useCallback(
    async ({ userGesture = false } = {}) => {
      if (!userGesture) {
        const unlocked = isUiAudioUnlocked();
        setAudioUnlocked(unlocked);
        setNeedsUnlock(isIosSafari && !unlocked);
        return unlocked;
      }

      const unlocked = await primeUiAudio({
        mediaElements: audioRef.current ? [audioRef.current] : [],
      });
      const nextUnlocked = Boolean(unlocked || isUiAudioUnlocked());
      setAudioUnlocked(nextUnlocked);
      setNeedsUnlock(isIosSafari && !nextUnlocked);
      return nextUnlocked;
    },
    [isIosSafari],
  );

  const playEffect = useCallback(
    async (effect, { userGesture = false } = {}) => {
      if (!effect?.src) {
        return false;
      }

      const requestId = playRequestRef.current + 1;
      playRequestRef.current = requestId;
      stop({ clearSource: false, preserveRequest: true });
      setActiveEffectId(effect.id || effect.fileName || effect.src);
      setStatus("loading");

      const unlocked = await prime({ userGesture });
      if (isIosSafari && !unlocked) {
        resetPlaybackState();
        return false;
      }

      onBeforePlay?.(effect);

      try {
        const bufferedPlayback = await playBufferedUiAudio(effect.src, {
          volume,
          onEnded: () => {
            if (requestId !== playRequestRef.current) {
              return;
            }
            bufferedPlaybackRef.current = null;
            resetPlaybackState();
            onAfterEnd?.();
          },
        });

        if (bufferedPlayback) {
          if (requestId !== playRequestRef.current) {
            bufferedPlayback.stop();
            return false;
          }

          bufferedPlaybackRef.current = bufferedPlayback;
          setStatus("playing");
          return true;
        }
      } catch {
        // Fall through to the media-element path below.
      }

      const audio = audioRef.current;
      if (!audio) {
        resetPlaybackState();
        return false;
      }

      let nextSrc =
        resolvedSrcByEffectRef.current.get(effect.id || effect.src) || effect.src;
      if (!resolvedSrcByEffectRef.current.has(effect.id || effect.src)) {
        try {
          nextSrc = await getCachedAudioAssetUrl(effect.src);
        } catch {
          nextSrc = effect.src;
        }
        resolvedSrcByEffectRef.current.set(effect.id || effect.src, nextSrc || effect.src);
      }

      if (requestId !== playRequestRef.current) {
        return false;
      }

      const sourceToUse = nextSrc || effect.src;
      const sourceChanged = audio.dataset.effectSrc !== sourceToUse;
      audio.dataset.effectSrc = sourceToUse;
      audio.preload = "auto";
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.volume = Math.max(0, Math.min(1, volume));
      if (sourceChanged) {
        audio.src = sourceToUse;
        audio.load();
      } else {
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore reset failures and still attempt playback.
        }
      }

      try {
        await audio.play();
        setStatus("playing");
        return true;
      } catch {
        resetPlaybackState();
        return false;
      }
    },
    [
      isIosSafari,
      onAfterEnd,
      onBeforePlay,
      prime,
      resetPlaybackState,
      stop,
      volume,
    ],
  );

  useEffect(() => () => stop(), [stop]);

  return {
    audioRef,
    activeEffectId,
    audioUnlocked,
    isPlaying: status === "loading" || status === "playing",
    needsUnlock,
    playEffect,
    prime,
    status,
    stop,
  };
}
