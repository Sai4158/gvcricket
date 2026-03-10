"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaBluetoothB,
  FaCheck,
  FaCopy,
  FaMicrophone,
  FaMicrophoneSlash,
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
import useLiveRelativeTime from "../live/useLiveRelativeTime";
import useSpeechAnnouncer from "../live/useSpeechAnnouncer";
import LiveScoreCard from "./LiveScoreCard";
import SplashMsg from "./SplashMsg";
import TeamInningsDetail from "./TeamInningsDetail";
import {
  buildCurrentScoreAnnouncement,
  buildSpectatorAnnouncement,
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

export default function SessionViewClient({ sessionId, initialData }) {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [activePanel, setActivePanel] = useState(null);
  const [localWalkieNotice, setLocalWalkieNotice] = useState("");
  const [streamError, setStreamError] = useState("");
  const [quickWalkieTalking, setQuickWalkieTalking] = useState(false);
  const [quickSpeakerTalking, setQuickSpeakerTalking] = useState(false);
  const lastAnnouncedEventRef = useRef("");
  const overDoneTimerRef = useRef(null);
  const scoreFollowUpTimerRef = useRef(null);
  const announcementDuckRef = useRef([]);
  const announcementRestoreTimerRef = useRef(null);
  const walkieHoldTimerRef = useRef(null);
  const walkieHeldRef = useRef(false);
  const suppressWalkieClickRef = useRef(false);
  const speakerHoldTimerRef = useRef(null);
  const speakerHeldRef = useRef(false);
  const previousEnabledRef = useRef(false);
  const previousWalkieEnabledRef = useRef(false);
  const router = useRouter();
  const liveUpdatedLabel = useLiveRelativeTime(data?.updatedAt);
  const { settings, updateSetting } = useAnnouncementSettings("spectator");
  const micMonitor = useLocalMicMonitor();
  const { speak, prime, stop } = useSpeechAnnouncer(settings);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    onMessage: (payload) => {
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

  const speakWithDuck = useCallback((text, options = {}, restoreAfterMs = 2200) => {
    const spoke = speak(text, options);
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
  }, [speak]);

  const clearAnnouncementTimers = useCallback(() => {
    if (overDoneTimerRef.current) {
      window.clearTimeout(overDoneTimerRef.current);
      overDoneTimerRef.current = null;
    }
    if (scoreFollowUpTimerRef.current) {
      window.clearTimeout(scoreFollowUpTimerRef.current);
      scoreFollowUpTimerRef.current = null;
    }
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
      speakWithDuck("Score announcer is now on. I will announce the next update.", {
        key: `spectator-announcer-on-${match?._id || "match"}`,
        rate: 0.9,
        interrupt: true,
      }, 1400);
    }

    previousEnabledRef.current = true;
  }, [clearAnnouncementTimers, isLiveMatch, match, settings.enabled, settings.mode, speakWithDuck, stop]);

  useEffect(() => {
    const event = match?.lastLiveEvent;
    if (!event || !isLiveMatch || !settings.enabled || settings.mode === "silent") {
      return;
    }
    if (lastAnnouncedEventRef.current === event.id) return;

    lastAnnouncedEventRef.current = event.id;
    const line = buildSpectatorAnnouncement(event, match, settings.mode);
    if (!line) return;

    speakWithDuck(line, {
      key: event.id,
      rate: 0.9,
      minGapMs: event.overCompleted ? 2200 : 900,
    }, 1400);

    if (scoreFollowUpTimerRef.current) {
      window.clearTimeout(scoreFollowUpTimerRef.current);
      scoreFollowUpTimerRef.current = null;
    }

    const scoreLine = buildSpectatorScoreAnnouncement(event, match);
    if (scoreLine) {
      scoreFollowUpTimerRef.current = window.setTimeout(() => {
        speakWithDuck(scoreLine, {
          key: `${event.id}-score`,
          rate: 0.88,
          minGapMs: 1200,
        }, 1700);
      }, 1200);
    }

    if (overDoneTimerRef.current) {
      window.clearTimeout(overDoneTimerRef.current);
      overDoneTimerRef.current = null;
    }

    if (event.overCompleted) {
      overDoneTimerRef.current = window.setTimeout(() => {
        speakWithDuck(buildSpectatorOverCompleteAnnouncement(match), {
          key: `${event.id}-over-summary`,
          rate: 0.9,
          minGapMs: 2000,
        }, 2300);
      }, 2000);
    }
  }, [isLiveMatch, match, settings.enabled, settings.mode, speakWithDuck]);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickAnnounce = () => {
    if (!match) {
      return;
    }

    prime();
    speakWithDuck(
      buildCurrentScoreAnnouncement(match),
      {
        key: `spectator-quick-score-${match._id}`,
        rate: 0.88,
        minGapMs: 1500,
        ignoreEnabled: true,
      },
      2400
    );
  };

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
  const walkieCardTalking = quickWalkieTalking || walkie.isSelfTalking;
  const speakerCardTalking = quickSpeakerTalking || micMonitor.isActive;
  const launcherCardClass =
    "flex min-h-[92px] w-full items-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,28,0.95),rgba(10,10,12,0.95))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-transform hover:-translate-y-0.5";
  const launcherBadgeClass =
    "min-w-[58px] rounded-full px-3 py-1 text-center text-xs font-semibold";

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

  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans p-4 pb-10 flex flex-col items-center">
      <MatchHeroBackdrop match={match} className="w-full max-w-4xl my-8">
        <div className="px-5 py-7 sm:px-7">
          <header className="w-full text-center relative">
            <button
              onClick={() => router.push("/session")}
              className="absolute top-1/2 -translate-y-1/2 left-2 p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Back to Sessions"
            >
              <FaArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-white">
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
              <p className="text-amber-500 font-bold text-xl" suppressHydrationWarning>
                {liveUpdatedLabel}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="absolute top-1/2 -translate-y-1/2 right-2 p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Copy Link"
            >
              {copied ? (
                <FaCheck className="text-green-500" size={20} />
              ) : (
                <FaCopy size={20} />
              )}
            </button>
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
              setActivePanel("walkie");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActivePanel("walkie");
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
                {walkieCardTalking
                  ? "You are speaking."
                  : walkie.snapshot?.enabled
                  ? "Hold mic to talk."
                  : "Tap to open."}
              </span>
            </span>
            {walkie.snapshot?.enabled ? (
              <span className="flex flex-col items-end gap-2">
                <span
                  className={`${launcherBadgeClass} ${
                    walkieCardTalking
                      ? "bg-emerald-500 text-black"
                      : "bg-emerald-500/15 text-emerald-200"
                  }`}
                >
                  {walkieCardTalking ? "Live" : "On"}
                </span>
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
              </span>
            ) : (
              <span className={`${launcherBadgeClass} bg-rose-500/12 text-rose-200`}>
                Off
              </span>
            )}
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
          {speakerMicOn ? (
            <span className="flex flex-col items-end gap-2">
              <span
                className={`${launcherBadgeClass} ${
                  speakerCardTalking
                    ? "bg-emerald-500 text-black"
                    : "bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {speakerCardTalking ? "Live" : "On"}
              </span>
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
            </span>
          ) : (
            <span
              className={`${launcherBadgeClass} bg-rose-500/12 text-rose-200`}
            >
              Off
            </span>
          )}
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
          <span
            className={`${launcherBadgeClass} ${
              settings.enabled
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-rose-500/12 text-rose-200"
            }`}
          >
            {settings.enabled ? "On" : "Off"}
          </span>
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
                speakWithDuck("Score announcements on.", {
                  key: "spectator-voice-enabled",
                  rate: 0.9,
                  interrupt: false,
                  userGesture: true,
                  ignoreEnabled: true,
                });
              } else {
                stop();
              }
            }}
            statusText=""
            onAnnounceNow={() =>
              speakWithDuck(buildCurrentScoreAnnouncement(match), {
                key: "spectator-manual-score",
                rate: 0.9,
                userGesture: true,
              })
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
            countdown={walkie.countdown}
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
