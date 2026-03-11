"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaBluetoothB,
  FaCheck,
  FaMicrophone,
  FaMicrophoneSlash,
  FaShareAlt,
  FaVolumeUp,
} from "react-icons/fa";
import AnnouncementControls from "../live/AnnouncementControls";
import LiveMicModal from "../live/LiveMicModal";
import WalkiePanel, { WalkieNotice } from "../live/WalkiePanel";
import useLocalMicMonitor from "../live/useLocalMicMonitor";
import useAnnouncementSettings from "../live/useAnnouncementSettings";
import useWalkieTalkie from "../live/useWalkieTalkie";
import MatchHeroBackdrop from "../match/MatchHeroBackdrop";
import useEventSource from "../live/useEventSource";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import LiveScoreCard from "./LiveScoreCard";
import SplashMsg from "./SplashMsg";
import TeamInningsDetail from "./TeamInningsDetail";
import {
  buildCurrentScoreAnnouncement,
  buildSpectatorAnnouncement,
  getSpectatorAnnouncementPriority,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
} from "../../lib/live-announcements";
import { getTeamBundle } from "../../lib/team-utils";
import { duckPageMedia, restorePageMedia } from "../../lib/page-audio";
import { ModalBase } from "../match/MatchBaseModals";

function DualWalkieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5h4a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7V5.75L9 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="14" r="0.9" fill="currentColor" />
      <path
        d="M14.5 9h4a1 1 0 0 1 1 1v5.5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 8.5V7.25L18 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

function LoudspeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path
        d="M4.5 14H7l4.75 3.5V6.5L7 10H4.5A1.5 1.5 0 0 0 3 11.5v1A1.5 1.5 0 0 0 4.5 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9.5a4 4 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IosGlassSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-8 w-[58px] items-center rounded-full border p-1 transition ${
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/[0.04] opacity-55"
          : checked
          ? "border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.92),rgba(6,95,70,0.92))] shadow-[0_12px_28px_rgba(16,185,129,0.24)]"
          : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      }`}
    >
      <span
        className={`absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ${
          checked ? "opacity-30" : "opacity-100"
        }`}
        aria-hidden="true"
      />
      <span
        className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(229,231,235,0.92))] shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SessionViewClient({ sessionId, initialData }) {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [activePanel, setActivePanel] = useState(null);
  const [localWalkieNotice, setLocalWalkieNotice] = useState("");
  const [streamError, setStreamError] = useState("");
  const [walkieLauncherEnabled, setWalkieLauncherEnabled] = useState(false);
  const [quickWalkieTalking, setQuickWalkieTalking] = useState(false);
  const [quickSpeakerTalking, setQuickSpeakerTalking] = useState(false);
  const lastAnnouncedEventRef = useRef("");
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
  const walkieHoldTimerRef = useRef(null);
  const walkieHeldRef = useRef(false);
  const suppressWalkieClickRef = useRef(false);
  const speakerHoldTimerRef = useRef(null);
  const speakerHeldRef = useRef(false);
  const previousEnabledRef = useRef(false);
  const previousWalkieEnabledRef = useRef(false);
  const lastStreamUpdateRef = useRef(initialData?.updatedAt || "");
  const router = useRouter();
  const { settings, updateSetting } = useAnnouncementSettings("spectator");
  const micMonitor = useLocalMicMonitor();
  const { speakSequence, prime, stop, isSpeaking } = useSpeechAnnouncer(settings);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    onMessage: (payload) => {
      if (payload.updatedAt && payload.updatedAt === lastStreamUpdateRef.current) {
        return;
      }

      lastStreamUpdateRef.current = payload.updatedAt || "";
      startTransition(() => {
        setData(payload);
        setStreamError("");
      });
    },
    onError: () => {
      if (!data) {
        setStreamError("Could not load session data.");
      }
    },
  });

  const sessionData = data?.session;
  const match = data?.match;
  const isLiveMatch = Boolean(match?.isOngoing && !match?.result);
  const walkie = useWalkieTalkie({
    matchId: match?._id || "",
    enabled: Boolean(match?._id && isLiveMatch),
    role: "spectator",
    displayName: sessionData?.name ? `${sessionData.name} Spectator` : "Spectator",
  });

  const speakSequenceWithDuck = useCallback(
    (items, options = {}, restoreAfterMs = 2600) => {
      const spoke = speakSequence(items, options);
      if (!spoke) {
        return false;
      }

      duckPageMedia(announcementDuckRef, 0.18);
      if (announcementRestoreTimerRef.current) {
        window.clearTimeout(announcementRestoreTimerRef.current);
      }
      announcementRestoreTimerRef.current = window.setTimeout(() => {
        restorePageMedia(announcementDuckRef);
        announcementRestoreTimerRef.current = null;
      }, restoreAfterMs);

      return true;
    },
    [speakSequence]
  );

  const clearAnnouncementTimers = useCallback(() => {
    if (announcementRestoreTimerRef.current) {
      window.clearTimeout(announcementRestoreTimerRef.current);
      announcementRestoreTimerRef.current = null;
    }
    restorePageMedia(announcementDuckRef);
  }, []);

  useEffect(() => {
    const announcerEnabled = Boolean(match && isLiveMatch && settings.enabled && settings.mode !== "silent");

    if (!announcerEnabled) {
      if (previousEnabledRef.current) {
        clearAnnouncementTimers();
        stop();
      }
      previousEnabledRef.current = false;
      return;
    }

    if (!previousEnabledRef.current) {
      lastAnnouncedEventRef.current = match?.lastLiveEvent?.id || "";
      clearAnnouncementTimers();
      stop();
      speakSequenceWithDuck(
        [
          {
            text: "Score announcer is now on.",
            pauseAfterMs: 420,
            rate: 0.9,
          },
          {
            text: "I will announce the next update.",
            pauseAfterMs: 0,
            rate: 0.88,
          },
        ],
        {
          key: `spectator-announcer-on-${match?._id || "match"}`,
          priority: 3,
          interrupt: true,
        },
        1700
      );
    }

    previousEnabledRef.current = true;
  }, [clearAnnouncementTimers, isLiveMatch, match, settings.enabled, settings.mode, speakSequenceWithDuck, stop]);

  useEffect(() => {
    const event = match?.lastLiveEvent;
    if (!event || !isLiveMatch || !settings.enabled || settings.mode === "silent") {
      return;
    }
    if (lastAnnouncedEventRef.current === event.id) return;

    lastAnnouncedEventRef.current = event.id;
    const line = buildSpectatorAnnouncement(event, match, settings.mode);
    if (!line) return;
    const scoreLine = buildSpectatorScoreAnnouncement(event, match);
    const overSummary = event.overCompleted
      ? buildSpectatorOverCompleteAnnouncement(match)
      : "";
    const priority = getSpectatorAnnouncementPriority(event);
    const items = [
      {
        text: line,
        pauseAfterMs: scoreLine || overSummary ? 650 : 0,
        rate: 0.9,
      },
    ];

    if (scoreLine) {
      items.push({
        text: scoreLine,
        pauseAfterMs: overSummary ? 900 : 0,
        rate: 0.88,
      });
    }

    if (overSummary) {
      items.push({
        text: overSummary,
        pauseAfterMs: 0,
        rate: 0.9,
      });
    }

    const interrupt = priority >= 3 && isSpeaking;
    speakSequenceWithDuck(
      items,
      {
        key: event.id,
        priority,
        interrupt,
        minGapMs: priority >= 3 ? 900 : 450,
      },
      overSummary ? 3600 : scoreLine ? 2600 : 1700
    );
  }, [
    isLiveMatch,
    isSpeaking,
    match,
    settings.enabled,
    settings.mode,
    speakSequenceWithDuck,
  ]);

  useEffect(() => {
    if (!isLiveMatch) {
      stop();
    }
  }, [isLiveMatch, stop]);

  useEffect(() => {
    return () => {
      clearAnnouncementTimers();
    };
  }, [clearAnnouncementTimers]);

  useEffect(() => {
    const walkieEnabled = Boolean(walkie.snapshot?.enabled);
    previousWalkieEnabledRef.current = previousWalkieEnabledRef.current || false;

    if (
      isLiveMatch &&
      walkieEnabled &&
      !previousWalkieEnabledRef.current
    ) {
      const noticeTimer = window.setTimeout(() => {
        setLocalWalkieNotice("Walkietalkie is on.");
      }, 0);
      if (typeof window !== "undefined") {
        try {
          const audioContext = new window.AudioContext();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.001, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.24);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.25);
          oscillator.onended = () => {
            void audioContext.close().catch(() => {});
          };
        } catch {}
      }
      const timer = window.setTimeout(() => {
        setLocalWalkieNotice("");
      }, 2400);
      previousWalkieEnabledRef.current = walkieEnabled;
      return () => {
        window.clearTimeout(noticeTimer);
        window.clearTimeout(timer);
      };
    }

    previousWalkieEnabledRef.current = walkieEnabled;
  }, [isLiveMatch, walkie.snapshot?.enabled]);

  useEffect(() => {
    if (match?.result) {
      router.push(`/result/${match._id}`);
    }
  }, [match, router]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sessionData?.name || "GV Cricket live score",
          text: "View the live cricket score.",
          url: window.location.href,
        });
        return;
      } catch {
        // Fall back to copy below if native share is dismissed or unavailable.
      }
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickAnnounce = () => {
    if (!match) {
      return;
    }

    prime();
    speakSequenceWithDuck(
      [
        {
          text: buildCurrentScoreAnnouncement(match),
          pauseAfterMs: 0,
          rate: 0.88,
        },
      ],
      {
        key: `spectator-quick-score-${match._id}`,
        priority: 3,
        minGapMs: 1500,
        ignoreEnabled: true,
        userGesture: true,
      },
      2400
    );
  };

  const clearWalkieHoldTimer = () => {
    if (walkieHoldTimerRef.current) {
      window.clearTimeout(walkieHoldTimerRef.current);
      walkieHoldTimerRef.current = null;
    }
  };

  const clearSpeakerHoldTimer = () => {
    if (speakerHoldTimerRef.current) {
      window.clearTimeout(speakerHoldTimerRef.current);
      speakerHoldTimerRef.current = null;
    }
  };

  const handleWalkieLauncherPressStart = () => {
    if (!walkie.snapshot?.enabled || !walkie.canTalk) {
      return;
    }

    clearWalkieHoldTimer();
    walkieHoldTimerRef.current = window.setTimeout(async () => {
      walkieHeldRef.current = true;
      suppressWalkieClickRef.current = true;
      setQuickWalkieTalking(true);
      const started = await walkie.startTalking();
      if (!started) {
        walkieHeldRef.current = false;
        setQuickWalkieTalking(false);
        suppressWalkieClickRef.current = false;
      }
    }, 170);
  };

  const handleWalkieLauncherPressEnd = async () => {
    clearWalkieHoldTimer();
    if (!walkieHeldRef.current) {
      return;
    }

    walkieHeldRef.current = false;
    setQuickWalkieTalking(false);
    await walkie.stopTalking();
    window.setTimeout(() => {
      suppressWalkieClickRef.current = false;
    }, 80);
  };

  const handleSpeakerLauncherPressStart = () => {
    if (!speakerMicOn) {
      return;
    }

    clearSpeakerHoldTimer();
    speakerHoldTimerRef.current = window.setTimeout(async () => {
      speakerHeldRef.current = true;
      setQuickSpeakerTalking(true);
      const started = await micMonitor.start({ pauseMedia: true });
      if (!started) {
        speakerHeldRef.current = false;
        setQuickSpeakerTalking(false);
      }
    }, 170);
  };

  const handleSpeakerLauncherPressEnd = async () => {
    clearSpeakerHoldTimer();
    if (!speakerHeldRef.current) {
      return;
    }

    speakerHeldRef.current = false;
    setQuickSpeakerTalking(false);
    await micMonitor.stop({ resumeMedia: true });
  };

  const openWalkiePanel = useCallback(() => {
    setWalkieLauncherEnabled(true);
    setActivePanel("walkie");
  }, []);

  const closeWalkiePanel = useCallback(() => {
    setWalkieLauncherEnabled(false);
    setLocalWalkieNotice("");
    walkie.dismissNotice();
    setActivePanel((current) => (current === "walkie" ? null : current));
  }, [walkie]);

  const handleWalkieSwitchChange = useCallback(
    (nextChecked) => {
      if (nextChecked) {
        openWalkiePanel();
        return;
      }

      closeWalkiePanel();
    },
    [closeWalkiePanel, openWalkiePanel]
  );

  const handleSpeakerSwitchChange = useCallback(
    async (nextChecked) => {
      if (nextChecked) {
        setActivePanel("mic");
        return;
      }

      clearSpeakerHoldTimer();
      speakerHeldRef.current = false;
      setQuickSpeakerTalking(false);
      await micMonitor.stop({ resumeMedia: true });
      setActivePanel((current) => (current === "mic" ? null : current));
    },
    [micMonitor]
  );

  const handleAnnounceSwitchChange = useCallback(
    (nextChecked) => {
      updateSetting("enabled", nextChecked);

      if (nextChecked) {
        setActivePanel("announce");
        prime();
        speakSequenceWithDuck(
          [
            {
              text: "Score announcer is now on.",
              pauseAfterMs: 420,
              rate: 0.9,
            },
            {
              text: "I will announce the next update.",
              pauseAfterMs: 0,
              rate: 0.88,
            },
          ],
          {
            key: "spectator-voice-enabled",
            priority: 3,
            interrupt: true,
            userGesture: true,
            ignoreEnabled: true,
          },
          1700
        );
        return;
      }

      stop();
      setActivePanel((current) => (current === "announce" ? null : current));
    },
    [prime, speakSequenceWithDuck, stop, updateSetting]
  );

  if (!sessionId) return <SplashMsg>No Session ID provided.</SplashMsg>;
  if (streamError) return <SplashMsg>Could not load session data.</SplashMsg>;
  if (!sessionData) return <SplashMsg>Loading Session...</SplashMsg>;
  if (!match) {
    return <SplashMsg>The match for this session has not started yet.</SplashMsg>;
  }

  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");
  const showWalkieLauncher = Boolean(match?._id && isLiveMatch);
  const speakerMicOn = Boolean(micMonitor.isActive || micMonitor.isPaused);
  const walkieCardTalking =
    quickWalkieTalking || walkie.isSelfTalking || walkie.isFinishing;
  const speakerCardTalking = quickSpeakerTalking || micMonitor.isActive;
  const speakerSwitchOn = Boolean(speakerMicOn || activePanel === "mic");
  const announceSwitchOn = Boolean(settings.enabled);
  const launcherCardClass =
    "flex min-h-[92px] w-full items-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-transform hover:-translate-y-0.5";

  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans p-4 pb-10 flex flex-col items-center">
      <div className="w-full max-w-4xl mt-4 mb-2 flex items-center justify-between gap-3 px-1">
        <button
          onClick={() => router.push("/session")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Back to Sessions"
        >
          <FaArrowLeft size={15} />
          <span>Back</span>
        </button>
        <button
          onClick={handleShare}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          aria-label="Share Link"
        >
          {copied ? (
            <FaCheck className="text-green-500" size={18} />
          ) : (
            <FaShareAlt size={18} />
          )}
        </button>
      </div>

      <MatchHeroBackdrop match={match} className="w-full max-w-4xl my-8">
        <div className="px-5 py-7 sm:px-7">
          <header className="w-full text-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.15rem]">
                {sessionData.name}
              </h1>
              <br />
              <div className="flex items-center justify-center gap-3 mb-2">
                <p className="text-green-400">Live Spectator View</p>
                <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>
          </header>

          <div className="mt-8 flex justify-center">
            <LiveScoreCard match={match} />
          </div>
        </div>
      </MatchHeroBackdrop>

      <div className="w-full max-w-4xl mt-4">
        <WalkieNotice
          notice={localWalkieNotice || walkie.notice}
          onDismiss={() => {
            setLocalWalkieNotice("");
            walkie.dismissNotice();
          }}
        />
      </div>

      <div className="w-full max-w-4xl mt-4">
        {showWalkieLauncher ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (suppressWalkieClickRef.current) {
                suppressWalkieClickRef.current = false;
                return;
              }
              openWalkiePanel();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openWalkiePanel();
              }
            }}
            onPointerDown={handleWalkieLauncherPressStart}
            onPointerUp={() => {
              void handleWalkieLauncherPressEnd();
            }}
            onPointerCancel={() => {
              void handleWalkieLauncherPressEnd();
            }}
            onPointerLeave={() => {
              void handleWalkieLauncherPressEnd();
            }}
            className={`${launcherCardClass} mb-4`}
            aria-label="Open walkietalkie"
          >
            <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl shadow-[0_12px_26px_rgba(16,185,129,0.16)] ${
              walkieCardTalking
                ? "bg-emerald-500 text-black"
                : "bg-emerald-500/14 text-emerald-300"
            }`}>
              {walkieCardTalking ? <FaMicrophone /> : <DualWalkieIcon />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-white">
                Walkietalkie
              </span>
              <span className="mt-1 block text-xs text-zinc-400">
                {walkie.isFinishing
                  ? "Finishing message."
                  : walkieCardTalking
                  ? "You are speaking."
                  : walkieLauncherEnabled && walkie.snapshot?.enabled
                  ? "Hold mic to talk to others."
                  : "Turn on to open."}
              </span>
            </span>
            <span className="flex flex-col items-end gap-2">
              <IosGlassSwitch
                checked={walkieLauncherEnabled}
                onChange={handleWalkieSwitchChange}
                label="Toggle walkietalkie panel"
              />
              {walkie.snapshot?.enabled && walkieLauncherEnabled ? (
                <button
                  type="button"
                  aria-label="Hold walkietalkie mic"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    handleWalkieLauncherPressStart();
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    void handleWalkieLauncherPressEnd();
                  }}
                  onPointerCancel={(event) => {
                    event.stopPropagation();
                    void handleWalkieLauncherPressEnd();
                  }}
                  onPointerLeave={(event) => {
                    event.stopPropagation();
                    void handleWalkieLauncherPressEnd();
                  }}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                    walkieCardTalking
                      ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                      : "border-white/12 bg-white/[0.05] text-white"
                  }`}
                >
                  {walkieCardTalking ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </button>
              ) : null}
            </span>
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActivePanel("mic")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setActivePanel("mic");
            }
          }}
          className={launcherCardClass}
          aria-label="Open speaker mic"
        >
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl text-black shadow-[0_12px_26px_rgba(16,185,129,0.28)]"
            aria-hidden="true"
          >
            <LoudspeakerIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-white">
              Speaker mic
            </span>
            <span className="mt-1 inline-flex items-center gap-2 text-xs text-zinc-400">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.04]">
                <FaBluetoothB />
              </span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.04]">
                <FaVolumeUp />
              </span>
              <span>
                {speakerCardTalking
                  ? "You are speaking."
                  : speakerMicOn
                  ? "Hold mic to talk."
                  : "Use phone as a mic."}
              </span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-2">
            <IosGlassSwitch
              checked={speakerSwitchOn}
              onChange={(nextChecked) => {
                void handleSpeakerSwitchChange(nextChecked);
              }}
              label="Toggle speaker mic"
            />
            {speakerMicOn ? (
              <button
                type="button"
                aria-label="Hold speaker mic"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  handleSpeakerLauncherPressStart();
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  void handleSpeakerLauncherPressEnd();
                }}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                  void handleSpeakerLauncherPressEnd();
                }}
                onPointerLeave={(event) => {
                  event.stopPropagation();
                  void handleSpeakerLauncherPressEnd();
                }}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                  speakerCardTalking
                    ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                    : "border-white/12 bg-white/[0.05] text-white"
                }`}
              >
                {speakerCardTalking ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>
            ) : null}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActivePanel("announce")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setActivePanel("announce");
            }
          }}
          className={`${launcherCardClass} mt-4`}
          aria-label="Open announce score"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleQuickAnnounce();
            }}
            aria-label="Announce current score"
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-400/14 text-lg text-amber-200 transition hover:bg-amber-400/20"
          >
            <FaVolumeUp />
          </button>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-white">
              Announce score
            </span>
            <span className="mt-1 block text-xs text-zinc-400">
              Read live score.
            </span>
          </span>
          <IosGlassSwitch
            checked={announceSwitchOn}
            onChange={handleAnnounceSwitchChange}
            label="Toggle score announcer"
          />
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <TeamInningsDetail
          title={match.innings1?.team || teamA.name}
          inningsData={match.innings1}
        />
        <TeamInningsDetail
          title={match.innings2?.team || teamB.name}
          inningsData={match.innings2}
        />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
      {activePanel === "mic" ? (
        <LiveMicModal
          title="Spectator Commentary Mic"
          monitor={micMonitor}
          onClose={() => setActivePanel(null)}
        />
      ) : null}
      {activePanel === "announce" ? (
        <ModalBase title="" onExit={() => setActivePanel(null)} hideHeader>
          <AnnouncementControls
            title="Announce Score"
            settings={settings}
            updateSetting={updateSetting}
            simpleMode
            variant="modal"
            onClose={() => setActivePanel(null)}
            onToggleEnabled={(nextEnabled) => {
              if (nextEnabled) {
                prime();
                speakSequenceWithDuck(
                  [
                    {
                      text: "Score announcer is now on.",
                      pauseAfterMs: 420,
                      rate: 0.9,
                    },
                    {
                      text: "I will announce the next update.",
                      pauseAfterMs: 0,
                      rate: 0.88,
                    },
                  ],
                  {
                    key: "spectator-voice-enabled",
                    priority: 3,
                    interrupt: true,
                    userGesture: true,
                    ignoreEnabled: true,
                  },
                  1700
                );
              } else {
                stop();
              }
            }}
            statusText=""
            onAnnounceNow={() =>
              speakSequenceWithDuck(
                [
                  {
                    text: buildCurrentScoreAnnouncement(match),
                    pauseAfterMs: 0,
                    rate: 0.9,
                  },
                ],
                {
                  key: "spectator-manual-score",
                  priority: 3,
                  userGesture: true,
                },
                2400
              )
            }
            announceLabel="Read Live Score"
          />
        </ModalBase>
      ) : null}
      {activePanel === "walkie" && showWalkieLauncher ? (
        <ModalBase title="Walkie-Talkie" onExit={() => setActivePanel(null)}>
          <WalkiePanel
            role="spectator"
            snapshot={walkie.snapshot}
            notice={walkie.notice}
            error={walkie.error}
            canEnable={false}
            canRequestEnable={walkie.canRequestEnable}
            canTalk={walkie.canTalk}
            isSelfTalking={walkie.isSelfTalking}
            isFinishing={walkie.isFinishing}
            countdown={walkie.countdown}
            finishDelayLeft={walkie.finishDelayLeft}
            requestCooldownLeft={walkie.requestCooldownLeft}
            requestState={walkie.requestState}
            pendingRequests={walkie.pendingRequests}
            onRequestEnable={walkie.requestEnable}
            onToggleEnabled={() => {}}
            onStartTalking={walkie.startTalking}
            onStopTalking={walkie.stopTalking}
            onDismissNotice={walkie.dismissNotice}
            onAcceptRequest={() => {}}
            onDismissRequest={() => {}}
          />
        </ModalBase>
      ) : null}
    </main>
  );
}
