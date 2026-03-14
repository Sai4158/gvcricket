"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaBroadcastTower,
  FaBullhorn,
  FaCompactDisc,
  FaForward,
  FaGripVertical,
  FaHeadphones,
  FaInfoCircle,
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
import DirectorSessionPicker from "./DirectorSessionPicker";
import useEventSource from "../live/useEventSource";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import useWalkieTalkie from "../live/useWalkieTalkie";
import { WalkieNotice, WalkieTalkButton } from "../live/WalkiePanel";
import { buildCurrentScoreAnnouncement } from "../../lib/live-announcements";
import { getBattingTeamBundle } from "../../lib/team-utils";
import { playUiTone } from "../../lib/page-audio";

const DIRECTOR_AUDIO_LIBRARY_CACHE_KEY = "gv-director-audio-library-v1";
const DIRECTOR_AUDIO_METADATA_CACHE_KEY = "gv-director-audio-metadata-v1";
const DIRECTOR_SESSIONS_CACHE_KEY = "gv-director-sessions-v1";
const DIRECTOR_FORCE_REAUTH_KEY = "gv-director-force-reauth";
let directorAudioLibraryMemoryCache = null;
let directorSessionsMemoryCache = null;
let directorAudioMetadataMemoryCache = {};

function getDirectorAudioOrderStorageKey(sessionId) {
  return `gv-director-audio-order:${sessionId || "default"}`;
}

function readCachedDirectorSessions() {
  if (directorSessionsMemoryCache?.length) {
    return directorSessionsMemoryCache;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cachedValue = window.sessionStorage.getItem(DIRECTOR_SESSIONS_CACHE_KEY);
    if (!cachedValue) {
      return [];
    }
    const parsed = JSON.parse(cachedValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    directorSessionsMemoryCache = parsed;
    return parsed;
  } catch {
    return [];
  }
}

function writeCachedDirectorSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return;
  }

  directorSessionsMemoryCache = sessions;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DIRECTOR_SESSIONS_CACHE_KEY,
      JSON.stringify(sessions)
    );
  } catch {
    // Ignore storage failures and keep the in-memory cache.
  }
}

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

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
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
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
        aria-label={`How ${title} works`}
      >
        <FaInfoCircle />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-[min(18rem,calc(100vw-3rem))] max-w-[18rem] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,32,0.98),rgba(11,11,16,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] max-sm:right-0">
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
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
              {match?.isOngoing && !match?.result ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
              {session?.name || "Director Console"}
            </h1>
            <p className="mt-1 text-sm text-zinc-200/90">{teams}</p>
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

        <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Score</p>
          <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {buildDirectorScoreLine(match)}
          </p>
          <p className="mt-1 text-sm text-emerald-200">
            {match?.result ? "Match finished" : "Managing live"}
          </p>
        </div>
      </div>
    </SessionCoverHero>
  );
}

export default function DirectorConsoleClient({
  initialAuthorized = false,
  initialSessions = [],
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [sessions, setSessions] = useState(initialSessions || []);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    const firstLive = (initialSessions || []).find((item) => item.isLive);
    return firstLive?.session?._id || "";
  });
  const [managedSessionId, setManagedSessionId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [musicTracks, setMusicTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [musicState, setMusicState] = useState("idle");
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [masterVolume, setMasterVolume] = useState(1);
  const [speakerDeviceId, setSpeakerDeviceId] = useState("default");
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [speakerMessage, setSpeakerMessage] = useState("");
  const [consoleError, setConsoleError] = useState("");
  const [musicMessage, setMusicMessage] = useState("");
  const [directorHoldLive, setDirectorHoldLive] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryOrder, setLibraryOrder] = useState([]);
  const [libraryDurations, setLibraryDurations] = useState({});
  const [libraryCurrentTime, setLibraryCurrentTime] = useState(0);
  const [libraryLiveId, setLibraryLiveId] = useState("");
  const [libraryState, setLibraryState] = useState("idle");
  const [draggingLibraryId, setDraggingLibraryId] = useState("");
  const [libraryDropTargetId, setLibraryDropTargetId] = useState("");
  const audioRef = useRef(null);
  const effectsAudioRef = useRef(null);
  const musicUrlsRef = useRef([]);
  const [speechSettings, setSpeechSettings] = useState(createSpeechSettings);
  const speech = useSpeechAnnouncer(speechSettings);
  const micMonitor = useLocalMicMonitor();

  useEffect(() => {
    if (initialSessions?.length) {
      writeCachedDirectorSessions(initialSessions);
    }
  }, [initialSessions]);

  const markDirectorReauthRequired = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(DIRECTOR_FORCE_REAUTH_KEY, "1");
    } catch {
      // Ignore storage failures and fall back to in-memory state reset.
    }
  };

  const clearDirectorReauthRequired = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.removeItem(DIRECTOR_FORCE_REAUTH_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  const selectedSession = useMemo(() => {
    return (
      sessions.find((item) => item.session?._id === selectedSessionId) ||
      sessions.find((item) => item.isLive) ||
      sessions[0] ||
      null
    );
  }, [selectedSessionId, sessions]);

  const managedSession = useMemo(() => {
    if (!managedSessionId) {
      return null;
    }
    return sessions.find((item) => item.session?._id === managedSessionId) || null;
  }, [managedSessionId, sessions]);

  const audioOrderStorageKey = useMemo(
    () => getDirectorAudioOrderStorageKey(managedSession?.session?._id || selectedSession?.session?._id || ""),
    [managedSession?.session?._id, selectedSession?.session?._id]
  );

  const [liveMatch, setLiveMatch] = useState(managedSession?.match || null);
  useEffect(() => {
    setLiveMatch(managedSession?.match || null);
  }, [managedSession]);

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
    if (typeof window === "undefined") {
      return undefined;
    }

    const resetDirectorMode = () => {
      let shouldReset = false;

      try {
        shouldReset =
          window.localStorage.getItem(DIRECTOR_FORCE_REAUTH_KEY) === "1";
      } catch {
        shouldReset = false;
      }

      if (!shouldReset) {
        return;
      }

      clearDirectorReauthRequired();
      setAuthorized(false);
      setManagedSessionId("");
      setShowPicker(false);
      setPin("");
      setAuthError("");
    };

    resetDirectorMode();

    const handlePageShow = () => {
      resetDirectorMode();
    };

    const handlePageHide = () => {
      markDirectorReauthRequired();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (
      managedSessionId &&
      !sessions.some((item) => item.session?._id === managedSessionId)
    ) {
      setManagedSessionId("");
    }
  }, [managedSessionId, sessions]);

  useEffect(() => {
    if (!authorized || sessions.length) {
      return;
    }

    const cachedSessions = readCachedDirectorSessions();
    if (cachedSessions.length) {
      setSessions(cachedSessions);
      const nextLive = cachedSessions.find((item) => item.isLive);
      if (nextLive) {
        setSelectedSessionId(nextLive.session._id);
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/director/sessions", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ sessions: [] }));
      if (!response.ok || cancelled) {
        return;
      }
      const nextSessions = payload.sessions || [];
      writeCachedDirectorSessions(nextSessions);
      setSessions(nextSessions);
      const nextLive = nextSessions.find((item) => item.isLive);
      if (nextLive) {
        setSelectedSessionId(nextLive.session._id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized, sessions.length]);

  const fetchAudioLibrary = useCallback(async () => {
    const response = await fetch("/api/director/audio-library", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({ files: [] }));

    if (!response.ok) {
      setLibraryFiles([]);
      return;
    }

    const nextFiles = payload.files || [];
    directorAudioLibraryMemoryCache = nextFiles;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          DIRECTOR_AUDIO_LIBRARY_CACHE_KEY,
          JSON.stringify(nextFiles)
        );
      } catch {
        // Ignore storage failures and keep in-memory cache.
      }
    }
    setLibraryFiles(nextFiles);
  }, []);

  useEffect(() => {
    if (directorAudioLibraryMemoryCache?.length) {
      setLibraryFiles(directorAudioLibraryMemoryCache);
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const cachedValue = window.sessionStorage.getItem(
          DIRECTOR_AUDIO_LIBRARY_CACHE_KEY
        );
        if (cachedValue) {
          const parsed = JSON.parse(cachedValue);
          if (Array.isArray(parsed) && parsed.length) {
            directorAudioLibraryMemoryCache = parsed;
            setLibraryFiles(parsed);
            return;
          }
        }
      } catch {
        // Ignore broken cache and refresh from network below.
      }
    }

    let cancelled = false;

    const loadLibraryOnce = async () => {
      try {
        await fetchAudioLibrary();
      } catch {
        if (!cancelled) {
          setLibraryFiles((current) => current);
        }
      }
    };

    void loadLibraryOnce();

    return () => {
      cancelled = true;
    };
  }, [fetchAudioLibrary]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const cachedValue = window.sessionStorage.getItem(
        DIRECTOR_AUDIO_METADATA_CACHE_KEY
      );
      if (!cachedValue) {
        return;
      }
      const parsed = JSON.parse(cachedValue);
      if (parsed && typeof parsed === "object") {
        directorAudioMetadataMemoryCache = parsed;
        setLibraryDurations(parsed);
      }
    } catch {
      // Ignore broken cache.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(audioOrderStorageKey);
      if (!rawValue) {
        setLibraryOrder([]);
        return;
      }

      const parsed = JSON.parse(rawValue);
      setLibraryOrder(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLibraryOrder([]);
    }
  }, [audioOrderStorageKey]);

  useEffect(() => {
    if (!libraryFiles.length) {
      return;
    }

    const missingFiles = libraryFiles.filter(
      (file) => !Number.isFinite(libraryDurations[file.id])
    );

    if (!missingFiles.length) {
      return;
    }

    let cancelled = false;

    missingFiles.forEach((file) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = file.src;

      const finalize = () => {
        audio.src = "";
      };

      audio.onloadedmetadata = () => {
        if (cancelled) {
          finalize();
          return;
        }

        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        setLibraryDurations((current) => {
          if (Number.isFinite(current[file.id])) {
            return current;
          }
          const next = { ...current, [file.id]: duration };
          directorAudioMetadataMemoryCache = next;
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                DIRECTOR_AUDIO_METADATA_CACHE_KEY,
                JSON.stringify(next)
              );
            } catch {
              // Ignore storage failures.
            }
          }
          return next;
        });
        finalize();
      };

      audio.onerror = finalize;
    });

    return () => {
      cancelled = true;
    };
  }, [libraryDurations, libraryFiles]);

  const orderedLibraryFiles = useMemo(() => {
    if (!libraryFiles.length) {
      return [];
    }

    if (!libraryOrder.length) {
      return libraryFiles;
    }

    const orderMap = new Map(libraryOrder.map((id, index) => [id, index]));
    return [...libraryFiles].sort((left, right) => {
      const leftIndex = orderMap.has(left.id) ? orderMap.get(left.id) : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.has(right.id) ? orderMap.get(right.id) : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      const leftDuration = libraryDurations[left.id] || 0;
      const rightDuration = libraryDurations[right.id] || 0;
      if (leftDuration !== rightDuration) {
        return rightDuration - leftDuration;
      }
      return left.label.localeCompare(right.label);
    });
  }, [libraryDurations, libraryFiles, libraryOrder]);

  const handleLibraryReorder = (nextFiles) => {
    setLibraryFiles(nextFiles);
    const nextOrder = nextFiles.map((file) => file.id);
    setLibraryOrder(nextOrder);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(audioOrderStorageKey, JSON.stringify(nextOrder));
      } catch {
        // Ignore storage failures and keep the in-memory order.
      }
    }
  };

  const moveLibraryItem = (activeId, targetId) => {
    if (!activeId || !targetId || activeId === targetId) {
      return;
    }

    const activeIndex = orderedLibraryFiles.findIndex((file) => file.id === activeId);
    const targetIndex = orderedLibraryFiles.findIndex((file) => file.id === targetId);

    if (activeIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextFiles = [...orderedLibraryFiles];
    const [movedItem] = nextFiles.splice(activeIndex, 1);
    nextFiles.splice(targetIndex, 0, movedItem);
    handleLibraryReorder(nextFiles);
  };

  const handleLibraryDragStart = (event, fileId) => {
    setDraggingLibraryId(fileId);
    setLibraryDropTargetId("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fileId);
  };

  const handleLibraryDragEnter = (fileId) => {
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDragOver = (event, fileId) => {
    event.preventDefault();
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      event.dataTransfer.dropEffect = "move";
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDrop = (event, fileId) => {
    event.preventDefault();
    const activeId = event.dataTransfer.getData("text/plain") || draggingLibraryId;
    moveLibraryItem(activeId, fileId);
    setDraggingLibraryId("");
    setLibraryDropTargetId("");
  };

  const clearLibraryDragState = () => {
    setDraggingLibraryId("");
    setLibraryDropTargetId("");
  };

  useEventSource({
    url:
      authorized && managedSession?.match?._id
        ? `/api/live/matches/${managedSession.match._id}`
        : null,
    event: "match",
    enabled: Boolean(authorized && managedSession?.match?._id),
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
    matchId: managedSession?.match?._id || "",
    enabled: Boolean(authorized && managedSession?.match?._id && liveMatch?.isOngoing),
    role: "director",
    displayName:
      managedSession?.session?.name
        ? `${managedSession.session.name} Director`
        : "Director",
  });

  const readCurrentScore = () => {
    const targetMatch = liveMatch || managedSession?.match;
    if (!targetMatch || !speechSettings.enabled) {
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

      clearDirectorReauthRequired();
      setAuthorized(true);
      setPin("");
      const nextSessions = sessions.length ? sessions : readCachedDirectorSessions();
      if (nextSessions.length) {
        writeCachedDirectorSessions(nextSessions);
        setSessions(nextSessions);
        const nextLive = nextSessions.find((item) => item.isLive);
        setSelectedSessionId(
          nextLive?.session?._id || nextSessions?.[0]?.session?._id || ""
        );
      }
      setManagedSessionId("");
      setShowPicker(false);
    } catch {
      setAuthError("Could not verify PIN.");
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const logout = async () => {
    markDirectorReauthRequired();
    await fetch("/api/director/auth", {
      method: "DELETE",
    }).catch(() => {});
    setAuthorized(false);
    setManagedSessionId("");
    setShowPicker(false);
    setPin("");
    setAuthError("");
  };

  const leaveDirectorMode = async () => {
    await logout();
    router.push("/");
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

    const duckFactor = micMonitor.isActive ? 0.24 : libraryLiveId ? 0.3 : 1;
    audio.volume = musicVolume * masterVolume * duckFactor;
  }, [libraryLiveId, masterVolume, micMonitor.isActive, musicVolume]);

  useEffect(() => {
    const nextVolume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * masterVolume)
    );
    if (effectsAudioRef.current) {
      effectsAudioRef.current.volume = nextVolume;
    }
  }, [masterVolume, micMonitor.isActive]);

  useEffect(() => {
    const audio = effectsAudioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleEnded = () => {
      setLibraryLiveId("");
      setLibraryState("idle");
      setLibraryCurrentTime(0);
    };
    const handlePause = () => {
      setLibraryState((current) => (current === "loading" ? current : "paused"));
      if (!audio.ended) {
        setLibraryCurrentTime(audio.currentTime || 0);
      }
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
      setConsoleError("This audio file could not be played in this browser.");
      setLibraryLiveId("");
      setLibraryState("idle");
      setLibraryCurrentTime(0);
    };
    const handleTimeUpdate = () => {
      setLibraryCurrentTime(audio.currentTime || 0);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
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
              ? "Speaker selection is supported in this browser."
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
    setLibraryCurrentTime(0);
  };

  const playEffect = async (file) => {
    const audio = effectsAudioRef.current;
    if (!audio || !file?.src) {
      return;
    }

    if (libraryLiveId === file.id) {
      stopAllEffects();
      return;
    }

    stopAllEffects();
    setLibraryLiveId(file.id);
    setLibraryState("loading");
    setLibraryCurrentTime(0);
    audio.preload = "none";
    audio.src = file.src;
    audio.volume = Math.max(
      0,
      Math.min(1, (micMonitor.isActive ? 0.24 : 1) * masterVolume)
    );

    try {
      await audio.play();
    } catch {
      setConsoleError("This audio file could not be played in this browser.");
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

  useEffect(() => {
    setConsoleError("");
    setMusicMessage("");
    setAuthError("");
    setDirectorHoldLive(false);
    setLibraryCurrentTime(0);
    setLibraryLiveId("");
    setLibraryState("idle");
    setDraggingLibraryId("");
    setLibraryDropTargetId("");

    if (effectsAudioRef.current) {
      effectsAudioRef.current.pause();
      effectsAudioRef.current.currentTime = 0;
      effectsAudioRef.current.src = "";
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setMusicState("idle");
  }, [managedSessionId]);

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
      setSpeakerMessage("Output routing is not supported in this browser.");
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

  const currentTrack = musicTracks[currentTrackIndex];

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof MediaMetadata === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: "Local phone audio",
      album: "GV Cricket Music Deck",
    });
    navigator.mediaSession.playbackState =
      musicState === "playing" ? "playing" : "paused";

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) {
          return;
        }
        audio
          .play()
          .then(() => {
            setMusicState("playing");
          })
          .catch(() => {});
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setMusicState("paused");
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (musicTracks.length > 1) {
          setCurrentTrackIndex((index) => (index + 1) % musicTracks.length);
        }
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setMusicState("stopped");
      });
    } catch {
      // Some browsers only support a subset of media session actions.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // Ignore unsupported action cleanup.
      }
    };
  }, [currentTrack, musicState, musicTracks.length]);

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
  const canManageSession = Boolean(authorized && managedSession?.match?._id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:max-w-[1500px] lg:px-6 2xl:max-w-[1760px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            void leaveDirectorMode();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
        >
          <FaArrowLeft />
          Home
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {authorized ? (
            <button
              type="button"
              onClick={() => {
                setManagedSessionId("");
                setShowPicker(true);
              }}
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white"
            >
              Change session
            </button>
          ) : null}
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

      {managedSession ? (
        <SessionHeader
          selectedSession={managedSession}
          liveMatch={liveMatch}
          onChangeSession={() => {
            setManagedSessionId("");
            setShowPicker(true);
          }}
          readCurrentScore={authorized ? readCurrentScore : () => {}}
        />
      ) : (
        <SessionCoverHero
          imageUrl={
            selectedSession?.match?.matchImageUrl ||
            selectedSession?.session?.matchImageUrl ||
            ""
          }
          alt="Director console cover"
          className="mb-5"
          priority
        >
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {!authorized ? (
              <>
                <div className="space-y-2 text-center sm:text-left">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                    <FaBroadcastTower className="text-xl" />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                    Enter Director Mode
                  </h1>
                  <p className="text-sm leading-6 text-zinc-300">
                    Enter the 4-digit PIN to choose a live session to manage.
                  </p>
                </div>
                {authError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {authError}
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
                  <label
                    htmlFor="director-inline-pin"
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                  >
                    Director PIN
                  </label>
                  <input
                    id="director-inline-pin"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={pin}
                    onChange={(event) =>
                      setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitDirectorPin();
                      }
                    }}
                    placeholder="0000"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-emerald-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                  />
                  <button
                    type="button"
                    onClick={() => void submitDirectorPin()}
                    disabled={isSubmittingPin || pin.length !== 4}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmittingPin ? "Checking..." : "Enter Director Mode"}
                  </button>
                </div>
              </>
            ) : showPicker || !selectedSession ? (
              <div className="space-y-4">
                <div className="text-center sm:text-left">
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                    Choose a live session
                  </h1>
                  <p className="mt-1 text-sm text-zinc-300">
                    Pick the session you want to manage.
                  </p>
                </div>
                <DirectorSessionPicker
                  sessions={sessions}
                  onSelect={(item) => {
                    setSelectedSessionId(item.session._id);
                    setShowPicker(false);
                    setAuthError("");
                  }}
                  onQuickStart={(item) => {
                    setSelectedSessionId(item.session._id);
                    setShowPicker(false);
                    setAuthError("");
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center sm:text-left">
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                    Manage this session?
                  </h1>
                  <p className="mt-1 text-sm text-zinc-200">
                    {selectedSession.session?.name || "Live session"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedSession.match?.teamAName && selectedSession.match?.teamBName
                      ? `${selectedSession.match.teamAName} vs ${selectedSession.match.teamBName}`
                      : "Teams pending"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-sm text-zinc-300">
                    Is this the session you want to manage?
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setManagedSessionId(selectedSession.session?._id || "");
                        setShowPicker(false);
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)]"
                    >
                      Yes, manage
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPicker(true)}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 font-semibold text-white"
                    >
                      Choose another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SessionCoverHero>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
          <FaHeadphones className="text-zinc-200" />
          {speakerMessage || "Using phone speaker output."}
        </span>
      </div>

      {authorized ? <WalkieNotice notice={walkie.notice} onDismiss={walkie.dismissNotice} /> : null}

      {authorized && consoleError ? (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {consoleError}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.78fr)] 2xl:grid-cols-[minmax(0,1.48fr)_minmax(380px,0.72fr)]">
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
                  {!canManageSession
                    ? "Enter director mode and choose a live session to use walkie."
                    : walkie.snapshot?.enabled
                    ? "Hold to talk with the live channel."
                    : walkie.requestState === "pending"
                    ? "Request sent. Waiting for the umpire."
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
                {walkie.snapshot?.enabled ? (
                  <IosSwitch
                    checked
                    label="Walkie state"
                    onChange={() => {}}
                    disabled
                  />
                ) : null}
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
                    disabled={!canManageSession || !walkie.canRequestEnable}
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {!canManageSession
                      ? "Choose session first"
                      : walkie.requestState === "pending"
                      ? "Request sent"
                      : "Request walkie"}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Audio Library"
            subtitle="Tap to play audio."
            icon={<FaBullhorn />}
            help={{
              title: "Audio Library",
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
            <div className="rounded-[28px] border border-white/10 bg-black/15 p-2">
              {orderedLibraryFiles.length ? (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                  {orderedLibraryFiles.map((file) => (
                    <div
                      key={file.id}
                      onDragEnter={() => handleLibraryDragEnter(file.id)}
                      onDragOver={(event) => handleLibraryDragOver(event, file.id)}
                      onDrop={(event) => handleLibraryDrop(event, file.id)}
                      onDragEnd={clearLibraryDragState}
                      onClick={() => void playEffect(file)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void playEffect(file);
                        }
                      }}
                      className={`group relative aspect-square overflow-hidden rounded-[24px] border px-4 py-4 text-left transition cursor-pointer ${
                        libraryLiveId === file.id
                          ? "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(18,40,34,0.9),rgba(10,16,18,0.94))] shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      } ${
                        draggingLibraryId === file.id
                          ? "scale-[0.98] opacity-70 shadow-[0_20px_50px_rgba(0,0,0,0.34)]"
                          : ""
                      } ${
                        libraryDropTargetId === file.id
                          ? "border-emerald-300/40 ring-2 ring-emerald-400/20"
                          : ""
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                      <div className="flex h-full flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/90">
                              <FaMusic className="text-sm" />
                            </div>
                            <span
                              draggable
                              onDragStart={(event) => handleLibraryDragStart(event, file.id)}
                              onDragEnd={clearLibraryDragState}
                              className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-400 active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <FaGripVertical className="text-sm" />
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                              {file.label}
                            </div>
                            <div className="truncate text-xs text-zinc-400">{file.fileName}</div>
                          </div>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="space-y-1 text-xs text-zinc-400">
                            {libraryLiveId === file.id
                              ? libraryState === "loading"
                                ? "Loading..."
                                : "Playing"
                              : "Tap to play"}
                            <div className="text-[11px] text-zinc-500">
                              {libraryLiveId === file.id
                                ? `${formatAudioTime(libraryCurrentTime)} / ${formatAudioTime(
                                    libraryDurations[file.id] || 0
                                  )}`
                                : formatAudioTime(libraryDurations[file.id] || 0)}
                            </div>
                          </div>
                          {libraryLiveId === file.id ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                stopAllEffects();
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                              aria-label={`Stop ${file.label}`}
                            >
                              {libraryState === "loading" ? (
                                <FaMusic className="text-xs" />
                              ) : (
                                <FaPause className="text-xs" />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-left text-sm text-zinc-400"
                >
                  Drop audio files into <span className="font-semibold text-zinc-200">public/audio/effects</span> and they will appear here.
                </button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Score announcer"
            subtitle="Live score readout"
            icon={<FaVolumeUp />}
            help={{
              title: "Score announcer",
              body: "Keep score announcements on for the managed session. Use read current score any time for a quick update.",
            }}
            action={
              <IosSwitch
                checked={speechSettings.enabled}
                label="Score announcer"
                onChange={(nextChecked) =>
                  setSpeechSettings((current) => ({
                    ...current,
                    enabled: nextChecked,
                  }))
                }
              />
            }
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-sm text-zinc-300">
                  {speechSettings.enabled
                    ? "Score announcer is on."
                    : "Score announcer is off."}
                </p>
              </div>
              <button
                type="button"
                onClick={readCurrentScore}
                disabled={!canManageSession || !speechSettings.enabled}
                className="w-full rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-zinc-500 disabled:hover:translate-y-0"
              >
                {canManageSession
                  ? speechSettings.enabled
                    ? "Read current score"
                    : "Turn announcer on first"
                  : "Choose session first"}
              </button>
            </div>
          </Card>

          <Card
            title="Music Deck"
            subtitle="Files on this phone"
            icon={<FaMusic />}
            help={{
              title: "Music Deck",
              body: "Use audio files from Files, Downloads, or this phone. Connect a Bluetooth speaker first for louder playback. External apps like Spotify or Apple Music cannot be controlled here.",
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
                  Add audio files from Files, Downloads, or this phone.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Audio output"
            subtitle="Current playback route"
            icon={<FaHeadphones />}
            help={{
              title: "Audio output",
              body: "This shows where your audio is playing. Connect the phone to a Bluetooth speaker first for louder PA playback.",
            }}
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Current output
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {speakerDevices.length
                    ? "Phone / selected speaker output"
                    : "Phone speaker output"}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {speakerMessage || "Using your phone or current browser output."}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-sm font-semibold text-white">How to use it</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  <li>1. Connect your phone to a Bluetooth speaker.</li>
                  <li>2. Keep the speaker volume up.</li>
                  <li>3. Use PA mic, music, or sound effects from this page.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
