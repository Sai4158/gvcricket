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
  FaInfoCircle,
  FaLock,
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
import DarkSelect from "../shared/DarkSelect";
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

function createSpeechSettings() {
  return {
    enabled: true,
    muted: false,
    mode: "full",
    volume: 1,
  };
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

function HelpButton({ title, body }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
        aria-label={`How ${title} works`}
      >
        <FaInfoCircle />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 w-[min(18rem,calc(100vw-3rem))] max-w-[18rem] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,32,0.98),rgba(11,11,16,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] max-sm:left-0 max-sm:right-auto">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  subtitle = "",
  icon,
  children,
  action = null,
  help = null,
}) {
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
        <div className="flex items-center gap-2">
          {help ? <HelpButton title={help.title} body={help.body} /> : null}
          {action}
        </div>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
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

          <div className="flex items-center justify-center gap-2 sm:justify-end">
            <HelpButton
              title="Director console"
              body="Use this screen to manage the live session, PA mic, music, effects, and walkie."
            />
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
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1] max-sm:text-xs"
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
  const [consoleError, setConsoleError] = useState("");
  const [musicMessage, setMusicMessage] = useState("");
  const [directorHoldLive, setDirectorHoldLive] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [libraryLiveId, setLibraryLiveId] = useState("");
  const [libraryState, setLibraryState] = useState("idle");
  const audioRef = useRef(null);
  const effectsAudioRef = useRef(null);
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
    const effectsAudio = effectsAudioRef.current;

    return () => {
      musicUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (effectsAudio) {
        effectsAudio.pause();
        effectsAudio.src = "";
      }
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

  useEffect(() => {
    if (!authorized) {
      setLibraryFiles([]);
      setLibraryLiveId("");
      setLibraryState("idle");
      return;
    }

    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/director/audio-library", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({ files: [] }));

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setLibraryFiles([]);
        setLibraryMessage("Could not load audio files.");
        return;
      }

      setLibraryFiles(payload.files || []);
      setLibraryMessage("");
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

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

  useEffect(() => {
    const nextVolume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * effectsVolume * masterVolume)
    );
    if (effectsAudioRef.current) {
      effectsAudioRef.current.volume = nextVolume;
    }
  }, [effectsVolume, masterVolume, micMonitor.isActive]);

  useEffect(() => {
    const audio = effectsAudioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleEnded = () => {
      setLibraryLiveId("");
      setLibraryState("idle");
    };
    const handlePause = () => {
      setLibraryState((current) => (current === "loading" ? current : "paused"));
    };
    const handlePlay = () => {
      setLibraryState("playing");
    };
    const handleWaiting = () => {
      setLibraryState("loading");
    };
    const handleCanPlay = () => {
      setLibraryState((current) => (current === "loading" ? "paused" : current));
    };
    const handleError = () => {
      setLibraryMessage("This audio file could not be played here.");
      setLibraryLiveId("");
      setLibraryState("idle");
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, []);

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
    const audio = effectsAudioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = "";
    setLibraryLiveId("");
    setLibraryState("idle");
  };

  const playEffect = async (file) => {
    const audio = effectsAudioRef.current;
    if (!audio || !file?.src) {
      return;
    }

    setLibraryMessage("");

    if (libraryLiveId === file.id && libraryState === "playing") {
      audio.pause();
      return;
    }

    if (libraryLiveId === file.id && libraryState === "paused") {
      try {
        await audio.play();
      } catch {
        setLibraryMessage("Tap again to allow audio playback.");
      }
      return;
    }

    stopAllEffects();
    setLibraryLiveId(file.id);
    setLibraryState("loading");
    audio.preload = "none";
    audio.src = file.src;
    audio.volume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * effectsVolume * masterVolume)
    );

    try {
      await audio.play();
    } catch {
      setLibraryMessage("Tap again to allow audio playback.");
      setLibraryState("idle");
      setLibraryLiveId("");
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
          {authorized ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
            >
              <FaPowerOff />
              Exit
            </button>
          ) : null}
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
    : walkie.isFinishing
    ? "Finishing"
    : walkie.isSelfTalking
    ? "Director Live"
    : walkie.snapshot?.activeSpeakerRole === "umpire"
    ? "Umpire Live"
    : walkie.snapshot?.activeSpeakerRole === "spectator"
    ? "Spectator Live"
    : "Ready";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
        >
          <FaArrowLeft />
          Home
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
          >
            Change session
          </button>
          {authorized ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
            >
              <FaPowerOff />
              Exit
            </button>
          ) : null}
        </div>
      </div>

      <SessionHeader
        selectedSession={selectedSession}
        liveMatch={liveMatch}
        onChangeSession={() => setShowPicker(true)}
        readCurrentScore={authorized ? readCurrentScore : () => {}}
      />

      {!authorized ? (
        <div className="mt-6">
          <DirectorPinGate
            pin={pin}
            onPinChange={setPin}
            onSubmit={submitDirectorPin}
            isSubmitting={isSubmittingPin}
            error={authError}
          />
        </div>
      ) : null}

      {authorized ? (
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
      ) : null}

      {authorized ? <WalkieNotice notice={walkie.notice} onDismiss={walkie.dismissNotice} /> : null}

      {authorized && consoleError ? (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {consoleError}
        </div>
      ) : null}

      {!authorized ? (
        <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.96),rgba(10,10,14,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
              <FaLock />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Enter PIN to manage session</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Browse first, then enter the 4-digit PIN to use PA mic, music, effects,
                and walkie controls.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {authorized ? (
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
            help={{
              title: "PA mic",
              body: "Press and hold to speak over the phone speaker or connected Bluetooth speaker. Music and effects duck automatically while you talk.",
            }}
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
            help={{
              title: "Walkie with umpire",
              body: "Request walkie when it is off. Once it is on, you can talk with the umpire or spectators. Only one person can hold the channel at a time.",
            }}
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
                    ? "Hold to talk with the live channel."
                    : walkie.requestState === "pending"
                    ? "Request sent. Waiting for umpire."
                    : walkie.requestState === "dismissed"
                    ? "Umpire dismissed the request."
                    : "Ask the umpire to enable walkie."}
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
                  onChange={() => {
                    if (!walkie.snapshot?.enabled) {
                      void walkie.requestEnable();
                    }
                  }}
                  disabled={Boolean(walkie.snapshot?.enabled)}
                />
                {walkie.snapshot?.enabled ? (
                  <WalkieTalkButton
                    active={walkie.isSelfTalking}
                    finishing={walkie.isFinishing}
                    disabled={!walkie.canTalk}
                    countdown={walkie.countdown}
                    finishDelayLeft={walkie.finishDelayLeft}
                    onStart={walkie.startTalking}
                    onStop={walkie.stopTalking}
                    label="Hold to talk to umpire"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => void walkie.requestEnable()}
                    disabled={!walkie.canRequestEnable}
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {walkie.requestState === "pending"
                      ? "Request sent"
                      : "Request walkie"}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Audio library"
            subtitle="Files from public/audio/effects"
            icon={<FaBullhorn />}
            help={{
              title: "Audio library",
              body: "Drop audio files into public/audio/effects and they will show here automatically. Files only load when you tap them.",
            }}
            action={
              <button
                type="button"
                onClick={stopAllEffects}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-200"
              >
                Stop audio
              </button>
            }
          >
            <audio ref={effectsAudioRef} hidden preload="none" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {libraryLiveId
                  ? libraryState === "paused"
                    ? "Paused"
                    : libraryState === "loading"
                    ? "Loading"
                    : "Playing now"
                  : "Tap to play or pause"}
              </p>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                Audio
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
            {libraryMessage ? (
              <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                {libraryMessage}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              {libraryFiles.length ? (
                libraryFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => {
                      void playEffect(file);
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-[24px] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                      libraryLiveId === file.id
                        ? "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(18,40,34,0.9),rgba(10,16,18,0.94))] shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    }`}
                  >
                    <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                    <div className="flex h-full flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/90">
                          <FaMusic className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                            {file.label}
                          </div>
                          <div className="truncate text-xs text-zinc-400">{file.fileName}</div>
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="text-xs text-zinc-400">
                          {libraryLiveId === file.id
                            ? libraryState === "paused"
                              ? "Paused"
                              : libraryState === "loading"
                              ? "Loading..."
                              : "Playing"
                            : "Tap to play"}
                        </div>
                        {libraryLiveId === file.id ? (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                            {libraryState === "paused" ? <FaPlay className="text-xs" /> : <FaPause className="text-xs" />}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  disabled
                  className="col-span-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-left text-sm text-zinc-400"
                >
                  Drop audio files into <span className="font-semibold text-zinc-200">public/audio/effects</span> and they will appear here.
                </button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Speaker Output"
            subtitle="Phone, browser, or Bluetooth speaker"
            icon={<FaHeadphones />}
            help={{
              title: "Speaker output",
              body: "Choose the current phone speaker or another available audio output. On some mobile browsers the app uses the current device output automatically.",
            }}
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
                <DarkSelect
                  value={speakerDeviceId}
                  ariaLabel="Output device"
                  options={[
                    { value: "default", label: "Phone / current output" },
                    ...speakerDevices.map((device) => ({
                      value: device.deviceId,
                      label: device.label || "External speaker",
                    })),
                  ]}
                  onChange={(nextValue) => {
                    void handleSpeakerOutputChange(nextValue);
                  }}
                />
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
            help={{
              title: "Music deck",
              body: "Load local audio files from the phone, then play, pause, stop, or skip them during the session. The deck stays local to this browser.",
            }}
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
            help={{
              title: "Quick actions",
              body: "Read the current score aloud or stop every audio source instantly if you need a clean reset.",
            }}
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
      ) : null}
    </div>
  );
}
