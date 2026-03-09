"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaCheck, FaCopy } from "react-icons/fa";
import useEventSource from "../../../components/live/useEventSource";
import useLiveRelativeTime from "../../../components/live/useLiveRelativeTime";
import LiveScoreCard from "../../../components/session-view/LiveScoreCard";
import SplashMsg from "../../../components/session-view/SplashMsg";
import TeamInningsDetail from "../../../components/session-view/TeamInningsDetail";
import { getTeamBundle } from "../../../lib/team-utils";

export default function ViewSessionPage() {
  const { id: sessionId } = useParams();
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(null);
  const [streamError, setStreamError] = useState("");
  const router = useRouter();
  const liveUpdatedLabel = useLiveRelativeTime(data?.updatedAt);

  useEventSource({
    url: sessionId ? `/api/live/sessions/${sessionId}` : null,
    event: "session",
    enabled: Boolean(sessionId),
    onMessage: (payload) => {
      setData(payload);
      setStreamError("");
    },
    onError: () => {
      if (!data) {
        setStreamError("Could not load session data.");
      }
    },
  });

  const sessionData = data?.session;
  const match = data?.match;

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
      <header className="w-full max-w-4xl text-center my-8 relative">
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
          <p className="text-amber-500 font-bold text-xl">{liveUpdatedLabel}</p>
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

      <LiveScoreCard match={match} />

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
    </main>
  );
}
