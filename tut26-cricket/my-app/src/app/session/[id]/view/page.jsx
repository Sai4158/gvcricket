"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { FaArrowLeft, FaCheck, FaCopy } from "react-icons/fa";
import { countLegalBalls } from "../../../lib/match-scoring";
import { getBattingTeamBundle, getTeamBundle } from "../../../lib/team-utils";

const fetcher = (url) => fetch(url).then((res) => res.json());

const calculateRunRate = (score, history) => {
  const legalBalls = countLegalBalls(history);
  if (!legalBalls || !score) return "0.00";
  return (score / (legalBalls / 6)).toFixed(2);
};

const Ball = ({ runs, isOut, extraType }) => {
  let style;
  let label;

  if (isOut) {
    style = "bg-rose-600 text-white";
    label = "W";
  } else if (extraType === "wide") {
    style = "bg-amber-500 text-black";
    label = `${runs}Wd`;
  } else if (extraType) {
    style = "bg-purple-500 text-white";
    label = `${runs}${extraType.substring(0, 2)}`;
  } else if (runs === 0) {
    style = "bg-zinc-700 text-zinc-300";
    label = ".";
  } else if (runs === 6) {
    style = "bg-purple-500 text-white";
    label = "6";
  } else if (runs === 4) {
    style = "bg-sky-500 text-white";
    label = "4";
  } else {
    style = "bg-green-600 text-white";
    label = runs;
  }

  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${style}`}
    >
      {label}
    </div>
  );
};

const SplashMsg = ({ children }) => (
  <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-300 text-center px-4">
    <p className="text-xl font-medium">{children}</p>
    <Link
      href="/"
      className="mt-6 underline text-lg text-blue-400 hover:text-blue-300 transition"
    >
      Back to Home
    </Link>
  </main>
);

const LiveScoreCard = ({ match }) => {
  if (!match) return null;

  const battingTeam = getBattingTeamBundle(match);

  return (
    <div className="w-full max-w-xl bg-black/30 backdrop-blur-sm ring-1 ring-white/10 rounded-3xl p-6 text-center space-y-2 shadow-2xl shadow-zinc-900">
      <p className="text-5xl font-bold text-amber-300 tracking-wide mb-5">
        {battingTeam.name}
      </p>
      <p className="text-6xl font-extrabold text-white">
        <span className="text-green-600">{match.score}</span>/
        <span className="text-red-600">{match.outs}</span>
      </p>
      <br />
      <div className="text-2xl text-white flex justify-center items-center gap-4">
        <span>
          Total Players:{" "}
          <span className="font-bold text-white">{battingTeam.players.length}</span>
        </span>
      </div>
    </div>
  );
};

const TeamInningsDetail = ({ title, inningsData }) => {
  if (!inningsData) return null;

  const runRate = calculateRunRate(inningsData.score, inningsData.history);

  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl ring-1 ring-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <span className="text-2xl font-mono font-bold text-amber-300">
          {inningsData?.score ?? 0} Runs
        </span>
      </div>
      <div className="text-sm text-zinc-100 mb-4">Run Rate: {runRate}</div>
      <div className="space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
        {inningsData?.history.length > 0 ? (
          [...inningsData.history].reverse().map((over) => (
            <div key={over.overNumber}>
              <p className="font-semibold text-zinc-300 mb-2">
                Over {over.overNumber}
              </p>
              <div className="flex gap-2 flex-wrap">
                {over.balls.map((ball, index) => (
                  <Ball key={index} {...ball} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-yellow-200 font-bold">No overs bowled yet.</p>
        )}
      </div>
    </div>
  );
};

export default function ViewSessionPage() {
  const { id: sessionId } = useParams();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const { data, error } = useSWR(
    sessionId ? `/api/sessions/${sessionId}` : null,
    async (url) => {
      const session = await fetch(url).then((res) => res.json());
      if (!session.match) throw new Error("Match not linked to session");
      const match = await fetch(`/api/matches/${session.match}`).then((res) =>
        res.json()
      );
      return { session, match };
    },
    { refreshInterval: 15000 }
  );

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
  if (error) return <SplashMsg>Could not load session data.</SplashMsg>;
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
          <p className="text-green-400 mb-2">Live Spectator View</p>
          <p className="text-amber-500 font-bold text-xl">Updates Every 15s</p>
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
        <TeamInningsDetail title={match.innings1?.team || teamA.name} inningsData={match.innings1} />
        <TeamInningsDetail title={match.innings2?.team || teamB.name} inningsData={match.innings2} />
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
