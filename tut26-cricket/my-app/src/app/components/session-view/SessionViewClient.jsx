"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaCheck, FaCopy, FaMicrophone } from "react-icons/fa";
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
} from "../../lib/live-announcements";
import { getTeamBundle } from "../../lib/team-utils";

export default function SessionViewClient({ sessionId, initialData }) {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [streamError, setStreamError] = useState("");
  const lastAnnouncedEventRef = useRef("");
  const previousEnabledRef = useRef(false);
  const router = useRouter();
  const liveUpdatedLabel = useLiveRelativeTime(data?.updatedAt);
  const { settings, updateSetting } = useAnnouncementSettings("spectator");
  const micMonitor = useLocalMicMonitor();
  const { speak, prime, stop, status, voiceName } = useSpeechAnnouncer(settings);

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

  useEffect(() => {
    if (!match || !isLiveMatch || !settings.enabled || settings.mode === "silent") {
      previousEnabledRef.current = settings.enabled;
      return;
    }

    if (!previousEnabledRef.current && settings.enabled) {
      speak(buildCurrentScoreAnnouncement(match), {
        key: "spectator-current-score",
        rate: 0.9,
      });
    }

    previousEnabledRef.current = settings.enabled;
  }, [isLiveMatch, match, settings.enabled, settings.mode, speak]);

  useEffect(() => {
    const event = match?.lastLiveEvent;
    if (!event || !isLiveMatch || !settings.enabled || settings.mode === "silent") {
      return;
    }
    if (lastAnnouncedEventRef.current === event.id) return;

    lastAnnouncedEventRef.current = event.id;
    const line = buildSpectatorAnnouncement(event, match, settings.mode);
    if (!line) return;

    speak(line, {
      key: event.id,
      rate: 0.9,
      minGapMs: 700,
    });
  }, [isLiveMatch, match, settings.enabled, settings.mode, speak]);

  useEffect(() => {
    if (!isLiveMatch) {
      stop();
    }
  }, [isLiveMatch, stop]);

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

  if (!sessionId) return <SplashMsg>No Session ID provided.</SplashMsg>;
  if (streamError) return <SplashMsg>Could not load session data.</SplashMsg>;
  if (!sessionData) return <SplashMsg>Loading Session...</SplashMsg>;
  if (!match) {
    return <SplashMsg>The match for this session has not started yet.</SplashMsg>;
  }

  const teamA = getTeamBundle(match, "teamA");
  const teamB = getTeamBundle(match, "teamB");

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

          <div className="mt-8">
            <LiveScoreCard match={match} />
          </div>
        </div>
      </MatchHeroBackdrop>

      <div className="w-full max-w-4xl mt-6">
        <AnnouncementControls
          title="Announce Score"
          subtitle="Turn on smart live commentary, or replay the score anytime."
          settings={settings}
          updateSetting={updateSetting}
          onToggleEnabled={(nextEnabled) => {
            if (nextEnabled) {
              prime();
              speak("Score announcements on.", {
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
          statusText={
            settings.enabled
              ? status === "waiting_for_gesture"
                ? voiceName
                  ? `Voice ready: ${voiceName} - tap Read live score once to unlock audio on this browser`
                  : "Tap Read live score once to unlock audio on this browser."
                : voiceName
                ? `Voice ready: ${voiceName}`
                : "Voice will use your browser's English voice."
              : ""
          }
          onAnnounceNow={() =>
            speak(buildCurrentScoreAnnouncement(match), {
              key: "spectator-manual-score",
              rate: 0.9,
              userGesture: true,
            })
          }
          announceLabel="Read Live Score"
          announceHint="Replay the latest live score whenever you want."
        />
      </div>

      <div className="w-full max-w-4xl mt-4">
        <WalkieNotice notice={walkie.notice} onDismiss={walkie.dismissNotice} />
      </div>

      <div className="w-full max-w-4xl mt-4">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,32,0.96),rgba(10,10,12,0.96))] p-5 text-center shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-black shadow-[0_12px_30px_rgba(16,185,129,0.35)]">
              <FaMicrophone />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Start Commentary Mic</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Connect this phone to a Bluetooth speaker and use it as a simple live mic.
              </p>
            </div>
            <button
              onClick={() => setIsMicOpen(true)}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
              aria-label="Open live microphone"
            >
              <FaMicrophone />
              Start Commentary
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs text-zinc-500">
            Local on this phone only. Best after pairing to a nearby speaker.
          </div>
        </section>
      </div>

      {isLiveMatch && walkie.snapshot?.enabled ? (
        <div className="w-full max-w-4xl mt-4">
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
            onRequestEnable={walkie.requestEnable}
            onToggleEnabled={() => {}}
            onStartTalking={walkie.startTalking}
            onStopTalking={walkie.stopTalking}
            onDismissNotice={walkie.dismissNotice}
          />
        </div>
      ) : null}

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
      {isMicOpen ? (
        <LiveMicModal
          title="Spectator Commentary Mic"
          monitor={micMonitor}
          onClose={() => setIsMicOpen(false)}
        />
      ) : null}
    </main>
  );
}
