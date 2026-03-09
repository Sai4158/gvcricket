export function duckPageMedia(stateRef, duckVolume = 0.18) {
  if (typeof document === "undefined" || !stateRef) {
    return;
  }

  if (Array.isArray(stateRef.current) && stateRef.current.length > 0) {
    return;
  }

  const tracked = [];
  const mediaElements = document.querySelectorAll("audio, video");

  mediaElements.forEach((element) => {
    try {
      tracked.push({
        element,
        volume: typeof element.volume === "number" ? element.volume : 1,
        muted: Boolean(element.muted),
      });

      if (!element.muted) {
        element.volume = Math.min(element.volume, duckVolume);
      }
    } catch {
      // Ignore media elements the browser refuses to adjust.
    }
  });

  stateRef.current = tracked;
}

export function restorePageMedia(stateRef) {
  if (!stateRef || !Array.isArray(stateRef.current)) {
    return;
  }

  for (const item of stateRef.current) {
    try {
      item.element.muted = item.muted;
      item.element.volume = item.volume;
    } catch {
      // Ignore stale media elements removed from the page.
    }
  }

  stateRef.current = [];
}

export function playUiTone({
  frequency = 880,
  durationMs = 180,
  type = "sine",
  volume = 0.04,
} = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);
    oscillator.onended = () => {
      void audioContext.close().catch(() => {});
    };
  } catch {
    // Best-effort only.
  }
}
