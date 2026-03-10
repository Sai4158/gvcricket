"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaBroadcastTower,
  FaBullhorn,
  FaCompactDisc,
  FaForward,
  FaHeadphones,
  FaMicrophone,
  FaMusic,
  FaPause,
  FaPlay,
  FaPowerOff,
  FaStop,
  FaVolumeUp,
  FaWifi,
} from "react-icons/fa";
import SessionCoverHero from "../shared/SessionCoverHero";
import DirectorPinGate from "./DirectorPinGate";
import DirectorSessionPicker from "./DirectorSessionPicker";
import useEventSource from "../live/useEventSource";
import useLiveRelativeTime from "../live/useLiveRelativeTime";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useWalkieTalkie from "../live/useWalkieTalkie";
import { WalkieNotice, WalkieTalkButton } from "../live/WalkiePanel";
import { buildCurrentScoreAnnouncement } from "../../lib/live-announcements";
import { getBattingTeamBundle } from "../../lib/team-utils";
import { playUiTone } from "../../lib/page-audio";

const SOUND_EFFECTS = [
  { id: "horn", label: "Stadium horn", accent: "emerald" },
  { id: "cheer", label: "Crowd cheer", accent: "sky" },
  { id: "wicket", label: "Wicket hit", accent: "rose" },
  { id: "six", label: "Six burst", accent: "amber" },
  { id: "boundary", label: "Boundary clap", accent: "violet" },
  { id: "drum", label: "Drum roll", accent: "orange" },
  { id: "start", label: "Match start", accent: "teal" },
  { id: "break", label: "Break stinger", accent: "fuchsia" },
];

function createSpeechSettings() {
  return {
    enabled: true,
    muted: false,
    mode: "full",
    volume: 1,
  };
}

function getColorClasses(accent) {
  switch (accent) {
    case "sky":
      return "bg-sky-500/12 text-sky-200 border-sky-400/20";
    case "rose":
      return "bg-rose-500/12 text-rose-200 border-rose-400/20";
    case "amber":
      return "bg-amber-500/12 text-amber-200 border-amber-400/20";
    case "violet":
      return "bg-violet-500/12 text-violet-200 border-violet-400/20";
    case "orange":
      return "bg-orange-500/12 text-orange-200 border-orange-400/20";
    case "teal":
      return "bg-teal-500/12 text-teal-200 border-teal-400/20";
    case "fuchsia":
      return "bg-fuchsia-500/12 text-fuchsia-200 border-fuchsia-400/20";
    default:
      return "bg-emerald-500/12 text-emerald-200 border-emerald-400/20";
  }
}

function buildDirectorScoreLine(match) {
  if (!match) return "";
  const battingTeam = getBattingTeamBundle(match);
  return `${battingTeam.name} ${match.score || 0}/${match.outs || 0}`;
}

function formatUpdatedText(value) {
  const date = new Date(value || 0).getTime();
  if (!date) return "Updated just now";
  const diffMs = Math.max(0, Date.now() - date);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function IosSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-[54px] items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/[0.08]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function Card({ title, subtitle = "", icon, children, action = null }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(10,10,14,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
            {icon}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SessionHeader({
  selectedSession,
  liveMatch,
  onChangeSession,
  readCurrentScore,
}) {
  const session = selectedSession?.session;
  const match = liveMatch || selectedSession?.match;
  const imageUrl = match?.matchImageUrl || session?.matchImageUrl || "";
  const teams =
    match?.teamAName && match?.teamBName
      ? `${match.teamAName} vs ${match.teamBName}`
      : session?.teamAName && session?.teamBName
      ? `${session.teamAName} vs ${session.teamBName}`
      : "Teams pending";

  return (
    <SessionCoverHero
      imageUrl={imageUrl}
      alt={`${session?.name || "Session"} cover`}
      className="mb-5"
      priority
    >
      <div className="space-y-6 px-5 py-6 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-emerald-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                Live console
              </span>
              {match?.isOngoing && !match?.result ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
              {session?.name || "Director Console"}
            </h1>
            <p className="mt-2 text-sm text-zinc-200/90">{teams}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={readCurrentScore}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-100 transition hover:bg-white/[0.1]"
              aria-label="Read current score"
            >
              <FaVolumeUp />
            </button>
            <button
              type="button"
              onClick={onChangeSession}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Change
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Score</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {buildDirectorScoreLine(match)}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-emerald-200">
              {match?.result ? "Finished" : match?.isOngoing ? "Managing live" : "Waiting"}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Updated</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatUpdatedText(match?.updatedAt || selectedSession?.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </SessionCoverHero>
  );
}

export default function DirectorConsoleClient({
  initialAuthorized = false,
  initialSessions = [],
}) {
  const [authorized, setAuthorized] = useState(Boolean(initialAuthorized));
  const [sessions, setSessions] = useState(initialSessions || []);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    const firstLive = (initialSessions || []).find((item) => item.isLive);
    return firstLive?.session?._id || "";
  });
  const [showPicker, setShowPicker] = useState(!(initialSessions || []).length);
  const [musicTracks, setMusicTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [musicState, setMusicState] = useState("idle");
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [effectsVolume, setEffectsVolume] = useState(0.85);
  const [masterVolume, setMasterVolume] = useState(1);
  const [speakerDeviceId, setSpeakerDeviceId] = useState("default");
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [speakerMessage, setSpeakerMessage] = useState("");
  const [soundboardLive, setSoundboardLive] = useState("");
  const [consoleError, setConsoleError] = useState("");
  const [musicMessage, setMusicMessage] = useState("");
  const [directorHoldLive, setDirectorHoldLive] = useState(false);
  const audioRef = useRef(null);
  const effectAudioContextRef = useRef(null);
  const effectMasterGainRef = useRef(null);
  const effectNodesRef = useRef([]);
  const musicUrlsRef = useRef([]);
  const speech = useSpeechAnnouncer(createSpeechSettings());
  const micMonitor = useLocalMicMonitor();

  const selectedSession = useMemo(() => {
    return (
      sessions.find((item) => item.session?._id === selectedSessionId) ||
      sessions.find((item) => item.isLive) ||
      sessions[0] ||
      null
    );
  }, [selectedSessionId, sessions]);

  const [liveMatch, setLiveMatch] = useState(selectedSession?.match || null);
  const liveUpdatedLabel = useLiveRelativeTime(
    liveMatch?.updatedAt || selectedSession?.updatedAt
  );

  useEffect(() => {
    setLiveMatch(selectedSession?.match || null);
  }, [selectedSession]);

  useEffect(() => {
    return () => {
      musicUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const firstLive = sessions.find((item) => item.isLive);
    if (!selectedSessionId && firstLive) {
      setSelectedSessionId(firstLive.session._id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!authorized || sessions.length) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/director/sessions", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ sessions: [] }));
      if (!response.ok || cancelled) {
        return;
      }
      setSessions(payload.sessions || []);
      const nextLive = (payload.sessions || []).find((item) => item.isLive);
      if (nextLive) {
        setSelectedSessionId(nextLive.session._id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized, sessions.length]);

  useEventSource({
    url:
      authorized && selectedSession?.match?._id
        ? `/api/live/matches/${selectedSession.match._id}`
        : null,
    event: "match",
    enabled: Boolean(authorized && selectedSession?.match?._id),
    onMessage: (payload) => {
      startTransition(() => {
        setLiveMatch(payload);
        setConsoleError("");
      });
    },
    onError: () => {
      if (!liveMatch) {
        setConsoleError("Could not load live match state.");
      }
    },
  });

  const walkie = useWalkieTalkie({
    matchId: selectedSession?.match?._id || "",
    enabled: Boolean(authorized && selectedSession?.match?._id && liveMatch?.isOngoing),
    role: "director",
    displayName:
      selectedSession?.session?.name
        ? `${selectedSession.session.name} Director`
        : "Director",
  });

  const readCurrentScore = () => {
    const targetMatch = liveMatch || selectedSession?.match;
    if (!targetMatch) {
      return;
    }

    speech.prime();
    speech.speak(buildCurrentScoreAnnouncement(targetMatch), {
      key: `director-score-${targetMatch._id}`,
      userGesture: true,
      ignoreEnabled: true,
      rate: 0.9,
    });
  };

  const submitDirectorPin = async () => {
    setIsSubmittingPin(true);
    setAuthError("");

    try {
      const response = await fetch("/api/director/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response.json().catch(() => ({ message: "Could not verify PIN." }));

      if (!response.ok) {
        setAuthError(payload.message || "Could not verify PIN.");
        return;
      }

      setAuthorized(true);
      setPin("");

      const sessionResponse = await fetch("/api/director/sessions", {
        cache: "no-store",
      });
      const sessionPayload = await sessionResponse
        .json()
        .catch(() => ({ sessions: [] }));
      if (sessionResponse.ok) {
        setSessions(sessionPayload.sessions || []);
        const nextLive = (sessionPayload.sessions || []).find((item) => item.isLive);
        setSelectedSessionId(
          nextLive?.session?._id ||
            sessionPayload.sessions?.[0]?.session?._id ||
            ""
        );
        setShowPicker(!(sessionPayload.sessions || []).length);
      }
    } catch {
      setAuthError("Could not verify PIN.");
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const logout = async () => {
    await fetch("/api/director/auth", {
      method: "DELETE",
    }).catch(() => {});
    setAuthorized(false);
    setShowPicker(false);
  };

  const syncSinkId = async (deviceId) => {
    const audio = audioRef.current;
    if (!audio || typeof audio.setSinkId !== "function") {
      return false;
    }

    try {
      await audio.setSinkId(deviceId || "default");
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = musicVolume * masterVolume;
  }, [masterVolume, musicVolume]);

  const ensureEffectAudio = async () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!effectAudioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      effectAudioContextRef.current = new AudioContextClass({
        latencyHint: "interactive",
      });
      effectMasterGainRef.current = effectAudioContextRef.current.createGain();
      effectMasterGainRef.current.gain.value = effectsVolume * masterVolume;
      effectMasterGainRef.current.connect(effectAudioContextRef.current.destination);
    }

    if (effectAudioContextRef.current.state === "suspended") {
      await effectAudioContextRef.current.resume();
    }

    return effectAudioContextRef.current;
  };

  useEffect(() => {
    if (effectMasterGainRef.current) {
      effectMasterGainRef.current.gain.value =
        (micMonitor.isActive ? 0.22 : 1) * effectsVolume * masterVolume;
    }
  }, [effectsVolume, masterVolume, micMonitor.isActive]);

  useEffect(() => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setSpeakerMessage("Uses your phone or browser output.");
      return;
    }

    let cancelled = false;
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        const outputs = devices.filter((device) => device.kind === "audiooutput");
        setSpeakerDevices(outputs);
        if (outputs.length) {
          setSpeakerMessage(
            typeof HTMLMediaElement !== "undefined" &&
              "setSinkId" in HTMLMediaElement.prototype
              ? "Speaker selection supported on this browser."
              : "Using your phone or Bluetooth output."
          );
        } else {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stopAllEffects = () => {
    effectNodesRef.current.forEach((entry) => {
      try {
        entry.node.stop?.();
      } catch {}
      try {
        entry.node.disconnect?.();
      } catch {}
      try {
        entry.gain?.disconnect?.();
      } catch {}
    });
    effectNodesRef.current = [];
    setSoundboardLive("");
  };

  const scheduleOscillator = (context, masterGain, options) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(options.from, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(
      options.to ?? options.from,
      context.currentTime + (options.durationMs || 300) / 1000
    );
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      (options.volume ?? 0.16) * effectsVolume * masterVolume,
      context.currentTime + 0.02
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + (options.durationMs || 300) / 1000
    );
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + (options.durationMs || 300) / 1000);
    effectNodesRef.current.push({ node: oscillator, gain });
    oscillator.onended = () => {
      effectNodesRef.current = effectNodesRef.current.filter(
        (entry) => entry.node !== oscillator
      );
      try {
        gain.disconnect();
      } catch {}
      if (!effectNodesRef.current.length) {
        setSoundboardLive("");
      }
    };
  };

  const playEffect = async (effectId) => {
    const context = await ensureEffectAudio();
    if (!context || !effectMasterGainRef.current) {
      return;
    }

    stopAllEffects();
    setSoundboardLive(effectId);

    const masterGain = effectMasterGainRef.current;
    if (effectId === "horn") {
      scheduleOscillator(context, masterGain, {
        from: 540,
        to: 620,
        durationMs: 420,
        type: "sawtooth",
        volume: 0.18,
      });
      window.setTimeout(() => {
        scheduleOscillator(context, masterGain, {
          from: 620,
          to: 540,
          durationMs: 420,
          type: "sawtooth",
          volume: 0.18,
        });
      }, 180);
      return;
    }

    if (effectId === "cheer") {
      [440, 554, 660, 740].forEach((frequency, index) => {
        window.setTimeout(() => {
          scheduleOscillator(context, masterGain, {
            from: frequency,
            to: frequency + 40,
            durationMs: 260,
            type: "triangle",
            volume: 0.1,
          });
        }, index * 90);
      });
      return;
    }

    if (effectId === "wicket") {
      scheduleOscillator(context, masterGain, {
        from: 880,
        to: 330,
        durationMs: 360,
        type: "square",
        volume: 0.16,
      });
      return;
    }

    if (effectId === "six") {
      [523, 659, 784].forEach((frequency, index) => {
        window.setTimeout(() => {
          scheduleOscillator(context, masterGain, {
            from: frequency,
            to: frequency,
            durationMs: 240,
            type: "triangle",
            volume: 0.13,
          });
        }, index * 120);
      });
      return;
    }

    if (effectId === "boundary") {
      [420, 520, 620].forEach((frequency, index) => {
        window.setTimeout(() => {
          scheduleOscillator(context, masterGain, {
            from: frequency,
            to: frequency + 35,
            durationMs: 140,
            type: "triangle",
            volume: 0.12,
          });
        }, index * 80);
      });
      return;
    }

    if (effectId === "drum") {
      [110, 90, 70, 60].forEach((frequency, index) => {
        window.setTimeout(() => {
          scheduleOscillator(context, masterGain, {
            from: frequency,
            to: 30,
            durationMs: 180,
            type: "square",
            volume: 0.16,
          });
        }, index * 120);
      });
      return;
    }

    if (effectId === "start") {
      [392, 494, 587, 784].forEach((frequency, index) => {
        window.setTimeout(() => {
          scheduleOscillator(context, masterGain, {
            from: frequency,
            to: frequency,
            durationMs: 180,
            type: "triangle",
            volume: 0.12,
          });
        }, index * 110);
      });
      return;
    }

    if (effectId === "break") {
      scheduleOscillator(context, masterGain, {
        from: 740,
        to: 420,
        durationMs: 240,
        type: "sine",
        volume: 0.14,
      });
      window.setTimeout(() => {
        scheduleOscillator(context, masterGain, {
          from: 420,
          to: 240,
          durationMs: 260,
          type: "sine",
          volume: 0.12,
        });
      }, 160);
    }
  };

  const stopAllAudio = async () => {
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setMusicState("stopped");
    await micMonitor.stop({ resumeMedia: true });
    await walkie.stopTalking();
    stopAllEffects();
  };

  const handleMusicSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    musicUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const nextTracks = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(file),
      type: file.type || "audio/mpeg",
    }));
    musicUrlsRef.current = nextTracks.map((track) => track.url);
    setMusicTracks(nextTracks);
    setCurrentTrackIndex(0);
    setMusicMessage(
      `${nextTracks.length} track${nextTracks.length === 1 ? "" : "s"} loaded.`
    );
    window.setTimeout(() => setMusicMessage(""), 2200);
  };

  useEffect(() => {
    const currentTrack = musicTracks[currentTrackIndex];
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
    }

    void syncSinkId(speakerDeviceId);
  }, [currentTrackIndex, musicTracks, speakerDeviceId]);

  const handlePlayMusic = async () => {
    const audio = audioRef.current;
    const track = musicTracks[currentTrackIndex];
    if (!audio || !track) {
      return;
    }

    audio.src = track.url;
    audio.volume = musicVolume * masterVolume;
    const sinkApplied = await syncSinkId(speakerDeviceId);
    if (!sinkApplied && speakerDeviceId !== "default") {
      setSpeakerMessage("Output routing is not supported on this browser.");
    }

    try {
      await audio.play();
      setMusicState("playing");
      setMusicMessage(`Playing ${track.name}.`);
    } catch {
      setMusicMessage("Music playback was blocked by the browser.");
    }
  };

  const handlePauseMusic = () => {
    audioRef.current?.pause();
    setMusicState("paused");
  };

  const handleStopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setMusicState("stopped");
  };

  const handleNextMusic = async () => {
    if (!musicTracks.length) {
      return;
    }

    const nextIndex = (currentTrackIndex + 1) % musicTracks.length;
    setCurrentTrackIndex(nextIndex);
    window.setTimeout(() => {
      void handlePlayMusic();
    }, 60);
  };

  const handleTrackEnd = () => {
    if (musicTracks.length > 1) {
      void handleNextMusic();
      return;
    }
    setMusicState("stopped");
  };

  const handleDirectorMicStart = async () => {
    setDirectorHoldLive(true);
    playUiTone({ frequency: 900, durationMs: 100, type: "sine", volume: 0.04 });
    const started = await micMonitor.start({ pauseMedia: true });
    if (!started) {
      setDirectorHoldLive(false);
    }
  };

  const handleDirectorMicStop = async () => {
    setDirectorHoldLive(false);
    await micMonitor.stop({ resumeMedia: true });
  };

  const handleSpeakerOutputChange = async (deviceId) => {
    setSpeakerDeviceId(deviceId);
    const applied = await syncSinkId(deviceId);
    setSpeakerMessage(
      applied
        ? "Music routed to selected output."
        : "Using your phone or Bluetooth output."
    );
  };

  if (!authorized) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <DirectorPinGate
          pin={pin}
          onPinChange={setPin}
          onSubmit={submitDirectorPin}
          isSubmitting={isSubmittingPin}
          error={authError}
        />
      </div>
    );
  }

  if (showPicker || !selectedSession) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
          >
            <FaArrowLeft />
            Home
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
          >
            <FaPowerOff />
            Exit
          </button>
        </div>
        <DirectorSessionPicker
          sessions={sessions}
          onSelect={(item) => {
            setSelectedSessionId(item.session._id);
            setShowPicker(false);
          }}
          onQuickStart={(item) => {
            setSelectedSessionId(item.session._id);
            setShowPicker(false);
          }}
        />
      </div>
    );
  }

  const currentTrack = musicTracks[currentTrackIndex];
  const walkieStatus = !walkie.snapshot?.enabled
    ? "Off"
    : walkie.isSelfTalking
    ? "Director Live"
    : walkie.snapshot?.activeSpeakerRole === "umpire"
    ? "Umpire Live"
    : walkie.snapshot?.activeSpeakerRole === "spectator"
    ? "Spectator Live"
    : "Ready";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
        >
          <FaArrowLeft />
          Home
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
          >
            Change session
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
          >
            <FaPowerOff />
            Exit
          </button>
        </div>
      </div>

      <SessionHeader
        selectedSession={selectedSession}
        liveMatch={liveMatch}
        onChangeSession={() => setShowPicker(true)}
        readCurrentScore={readCurrentScore}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
          <FaWifi className="text-emerald-300" />
          {liveUpdatedLabel}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
          <FaHeadphones className="text-zinc-200" />
          {speakerMessage || "Using phone speaker output."}
        </span>
      </div>

      <WalkieNotice notice={walkie.notice} onDismiss={walkie.dismissNotice} />

      {consoleError ? (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {consoleError}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Card
            title="PA Mic"
            subtitle={
              directorHoldLive || micMonitor.isActive
                ? "Live on speaker"
                : "Hold to talk over PA"
            }
            icon={<FaMicrophone />}
            action={
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  directorHoldLive || micMonitor.isActive
                    ? "bg-emerald-500/14 text-emerald-200"
                    : "bg-white/[0.06] text-zinc-300"
                }`}
              >
                {directorHoldLive || micMonitor.isActive ? "Live" : "Ready"}
              </span>
            }
          >
            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-5">
              <div className="flex flex-col items-center gap-4 text-center">
                <button
                  type="button"
                  onPointerDown={() => {
                    void handleDirectorMicStart();
                  }}
                  onPointerUp={() => {
                    void handleDirectorMicStop();
                  }}
                  onPointerCancel={() => {
                    void handleDirectorMicStop();
                  }}
                  onPointerLeave={() => {
                    void handleDirectorMicStop();
                  }}
                  className={`relative inline-flex h-28 w-28 items-center justify-center rounded-full border text-3xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${
                    directorHoldLive || micMonitor.isActive
                      ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.34)]"
                      : "border-white/10 bg-white/[0.05] text-white"
                  }`}
                  aria-label="Hold to talk on PA mic"
                >
                  <span
                    className={`absolute inset-[-8px] rounded-full border ${
                      directorHoldLive || micMonitor.isActive
                        ? "animate-pulse border-emerald-300/35"
                        : "border-transparent"
                    }`}
                  />
                  <FaMicrophone />
                </button>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {directorHoldLive || micMonitor.isActive
                      ? "Release to stop"
                      : "Hold to talk"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Music and effects duck while you speak.
                  </p>
                </div>
                {micMonitor.error ? (
                  <p className="text-sm text-rose-300">{micMonitor.error}</p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card
            title="Walkie with umpire"
            subtitle="Shared live channel"
            icon={<FaBroadcastTower />}
            action={
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  walkieStatus === "Off"
                    ? "bg-rose-500/12 text-rose-200"
                    : walkieStatus.includes("Live")
                    ? "bg-emerald-500/14 text-emerald-200"
                    : "bg-white/[0.06] text-zinc-300"
                }`}
              >
                {walkieStatus}
              </span>
            }
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-zinc-300">
                    <FaBroadcastTower className="text-sky-300" />
                    {walkie.snapshot?.umpireCount || 0} umpire
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-zinc-300">
                    <FaHeadphones className="text-emerald-300" />
                    {walkie.snapshot?.directorCount || 0} director
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                  {walkie.snapshot?.enabled
                    ? "Hold to talk back to the umpire. One speaker at a time stays enforced."
                    : "Walkie is off until the umpire enables it."}
                </div>
                {walkie.error ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {walkie.error}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-center gap-4">
                <IosSwitch
                  checked={Boolean(walkie.snapshot?.enabled)}
                  label="Walkie state"
                  onChange={() => {}}
                  disabled
                />
                <WalkieTalkButton
                  active={walkie.isSelfTalking}
                  disabled={!walkie.canTalk}
                  countdown={walkie.countdown}
                  onStart={walkie.startTalking}
                  onStop={walkie.stopTalking}
                  label="Hold to talk to umpire"
                />
              </div>
            </div>
          </Card>

          <Card
            title="Soundboard"
            subtitle="Stadium cues"
            icon={<FaBullhorn />}
            action={
              <button
                type="button"
                onClick={stopAllEffects}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
              >
                Stop effects
              </button>
            }
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {soundboardLive ? `${soundboardLive} live` : "Ready for cues"}
              </p>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                Effects
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={effectsVolume}
                  onChange={(event) => setEffectsVolume(Number(event.target.value))}
                  className="w-28 accent-emerald-400"
                  aria-label="Effects volume"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SOUND_EFFECTS.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => {
                    void playEffect(effect.id);
                  }}
                  className={`rounded-[22px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${getColorClasses(effect.accent)}`}
                >
                  <div className="text-sm font-semibold">{effect.label}</div>
                  <div className="mt-1 text-xs opacity-75">
                    {soundboardLive === effect.id ? "Playing now" : "Tap to play"}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Speaker Output"
            subtitle="Phone, browser, or Bluetooth speaker"
            icon={<FaHeadphones />}
            action={
              <span className="inline-flex rounded-full bg-emerald-500/14 px-3 py-1 text-xs font-semibold text-emerald-200">
                {speakerDevices.length ? "Selectable" : "Auto"}
              </span>
            }
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-sm text-zinc-300">
                  Connect phone to Bluetooth speaker to use phone as a mic and PA source.
                </p>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Output device
                </span>
                <select
                  value={speakerDeviceId}
                  onChange={(event) => {
                    void handleSpeakerOutputChange(event.target.value);
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                >
                  <option value="default">Phone / current output</option>
                  {speakerDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || "External speaker"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Master volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(event) => setMasterVolume(Number(event.target.value))}
                  className="w-full accent-emerald-400"
                />
              </label>
            </div>
          </Card>

          <Card
            title="Music Deck"
            subtitle="Local tracks from this phone"
            icon={<FaMusic />}
            action={
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                <FaCompactDisc />
                Add tracks
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={handleMusicSelection}
                />
              </label>
            }
          >
            <audio ref={audioRef} onEnded={handleTrackEnd} hidden />
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Now playing
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {currentTrack ? currentTrack.name : "No track loaded"}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {musicMessage ||
                    (musicState === "playing"
                      ? "Playing"
                      : musicState === "paused"
                      ? "Paused"
                      : "Ready")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handlePlayMusic();
                  }}
                  disabled={!currentTrack}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  aria-label="Play music"
                >
                  <FaPlay />
                </button>
                <button
                  type="button"
                  onClick={handlePauseMusic}
                  disabled={!currentTrack}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white disabled:cursor-not-allowed disabled:text-zinc-500"
                  aria-label="Pause music"
                >
                  <FaPause />
                </button>
                <button
                  type="button"
                  onClick={handleNextMusic}
                  disabled={!currentTrack || musicTracks.length < 2}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white disabled:cursor-not-allowed disabled:text-zinc-500"
                  aria-label="Next track"
                >
                  <FaForward />
                </button>
                <button
                  type="button"
                  onClick={handleStopMusic}
                  disabled={!currentTrack}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white disabled:cursor-not-allowed disabled:text-zinc-500"
                  aria-label="Stop music"
                >
                  <FaStop />
                </button>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Music volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(event) => setMusicVolume(Number(event.target.value))}
                  className="w-full accent-emerald-400"
                />
              </label>

              {musicTracks.length ? (
                <div className="space-y-2 rounded-[24px] border border-white/10 bg-black/20 p-3">
                  {musicTracks.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setCurrentTrackIndex(index)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm ${
                        index === currentTrackIndex
                          ? "bg-emerald-500/12 text-emerald-100"
                          : "text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="truncate">{track.name}</span>
                      {index === currentTrackIndex ? (
                        <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                          Live
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-400">
                  Add local audio files to build a simple match playlist.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Quick actions"
            subtitle="Fast control"
            icon={<FaBroadcastTower />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={readCurrentScore}
                className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5"
              >
                Read current score
              </button>
              <button
                type="button"
                onClick={() => {
                  void stopAllAudio();
                }}
                className="rounded-[22px] border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-left text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5"
              >
                Stop all audio
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
