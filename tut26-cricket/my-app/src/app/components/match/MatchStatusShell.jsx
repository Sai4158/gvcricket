"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: Splash, AccessGate, MatchHeader, Scoreboard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useState } from "react";
import { Barlow_Condensed } from "next/font/google";
import { FaPause, FaVolumeUp } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
import { getBattingTeamBundle } from "../../lib/team-utils";
import {
  clearClientPinRateLimit,
  registerClientPinFailure,
  useClientPinRateLimit,
} from "../../lib/pin-attempt-client";

const scoreboardDisplayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
});

function getBattingStripClasses(battingTeam) {
  const normalizedName = String(battingTeam?.name || "").trim().toLowerCase();

  if (normalizedName.includes("blue")) {
    return "from-sky-400/20 via-sky-400 to-blue-600/20";
  }

  if (normalizedName.includes("red")) {
    return "from-rose-400/20 via-rose-500 to-red-600/20";
  }

  return battingTeam?.key === "teamB"
    ? "from-sky-400/20 via-sky-400 to-blue-600/20"
    : "from-rose-400/20 via-rose-500 to-red-600/20";
}

function getBattingAccentClasses(battingTeam) {
  const normalizedName = String(battingTeam?.name || "").trim().toLowerCase();

  if (normalizedName.includes("blue")) {
    return {
      badge:
        "border-sky-400/20 bg-[linear-gradient(180deg,rgba(14,165,233,0.16),rgba(14,165,233,0.08))] text-sky-100 shadow-[0_18px_40px_rgba(14,165,233,0.12)]",
      team: "text-sky-300",
    };
  }

  if (normalizedName.includes("red")) {
    return {
      badge:
        "border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.16),rgba(244,63,94,0.08))] text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.12)]",
      team: "text-rose-300",
    };
  }

  return battingTeam?.key === "teamB"
    ? {
        badge:
          "border-sky-400/20 bg-[linear-gradient(180deg,rgba(14,165,233,0.16),rgba(14,165,233,0.08))] text-sky-100 shadow-[0_18px_40px_rgba(14,165,233,0.12)]",
        team: "text-sky-300",
      }
    : {
        badge:
          "border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.16),rgba(244,63,94,0.08))] text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.12)]",
        team: "text-rose-300",
      };
}

export function Splash({ children }) {
  return (
    <main className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white text-xl">
      {children}
    </main>
  );
}

export function AccessGate({
  onSubmit,
  isSubmitting,
  error,
  rateLimitScope = "match-auth",
}) {
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState("");
  const pinRateLimit = useClientPinRateLimit(rateLimitScope);
  const displayError = pinRateLimit.isBlocked
    ? pinRateLimit.message
    : error || localError;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (pinRateLimit.isBlocked) {
      setLocalError(pinRateLimit.message);
      return;
    }

    setLocalError("");

    try {
      await onSubmit(pin);
      clearClientPinRateLimit(rateLimitScope);
      pinRateLimit.sync();
    } catch (caughtError) {
      registerClientPinFailure(rateLimitScope, {
        retryAfterMs: Number(caughtError?.retryAfterMs || 0),
      });
      pinRateLimit.sync();
      setLocalError(caughtError?.message || "Incorrect PIN.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-sm bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-3">Umpire Access</h1>
        <p className="text-zinc-400 text-center mb-6">
          Enter the server PIN to unlock match controls.
        </p>
        <div className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={pin}
            disabled={isSubmitting || pinRateLimit.isBlocked}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="0000"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-blue-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
          />
          <LoadingButton
            type="button"
            onClick={handleSubmit}
            disabled={pin.length !== 4 || pinRateLimit.isBlocked}
            loading={isSubmitting}
            pendingLabel="Checking..."
            className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enter
          </LoadingButton>
        </div>
        {displayError ? (
          <p className="text-red-400 text-sm mt-4 text-center">{displayError}</p>
        ) : null}
      </div>
    </main>
  );
}

export function MatchHeader({
  match,
  onAnnounceScore = null,
  announceIsActive = false,
}) {
  const battingTeam = getBattingTeamBundle(match);
  const accent = getBattingAccentClasses(battingTeam);

  return (
    <header className="relative mb-4 text-center">
      <h1
        className={`${scoreboardDisplayFont.className} text-[3rem] font-black uppercase leading-none tracking-[0.04em] text-white sm:text-[3.6rem]`}
      >
        Umpire View
      </h1>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
        <span className={`${accent.team} uppercase`}>{battingTeam.name}</span>
        <span className="text-white/88"> batting now</span>
      </div>
      {match.innings === "second" && (
        <div className="mt-1 text-lg font-semibold text-zinc-300 sm:text-xl">
          <span className="text-white/70">Target:</span>{" "}
          <span className="text-[1.6rem] font-black text-amber-300 sm:text-[1.9rem]">
            {match.innings1.score + 1}
          </span>
        </div>
      )}
      {onAnnounceScore ? (
        <button
          type="button"
          onClick={onAnnounceScore}
          aria-label={announceIsActive ? "Stop current audio" : "Announce current score"}
          className={`absolute bottom-0 right-0 inline-flex h-11 w-11 items-center justify-center rounded-[18px] border text-white transition-all active:scale-[0.94] ${
            announceIsActive
              ? "border-white/50 bg-[linear-gradient(145deg,rgba(20,24,34,0.98),rgba(8,12,18,0.98))] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.26),0_0_22px_rgba(255,255,255,0.34),0_0_42px_rgba(255,255,255,0.16),inset_0_1px_0_rgba(255,255,255,0.16)]"
              : "border-white/32 bg-[linear-gradient(145deg,rgba(28,28,34,0.98),rgba(10,10,14,0.98))] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.18),inset_0_1px_0_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:border-white/60 hover:text-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_28px_rgba(255,255,255,0.28),0_0_46px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0"
          }`}
        >
          {announceIsActive ? (
            <FaPause className="text-[0.98rem]" />
          ) : (
            <FaVolumeUp className="text-[1.05rem]" />
          )}
        </button>
      ) : null}
    </header>
  );
}

export function Scoreboard({ match, legalBallCount = null }) {
  const legalBalls = Number.isFinite(Number(legalBallCount))
    ? Math.max(0, Number(legalBallCount || 0))
    : 0;
  const oversDisplay = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const battingTeam = getBattingTeamBundle(match);
  const ballsLeft = Math.max(Number(match?.overs || 0) * 6 - legalBalls, 0);
  const stripClasses = getBattingStripClasses(battingTeam);
  const statNumberWrapClassName =
    "flex min-h-[5.75rem] items-end justify-center sm:min-h-[6.5rem]";

  return (
    <div className="relative grid grid-cols-2 gap-4 text-center bg-zinc-900/50 p-4 rounded-2xl ring-1 ring-white/10">
      <span
        className={`pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gradient-to-r ${stripClasses}`}
      />
      <div className="flex flex-col items-center justify-center">
        <div
          className={`${scoreboardDisplayFont.className} ${statNumberWrapClassName} font-bold tabular-nums [font-variant-numeric:tabular-nums]`}
        >
          <span className="inline-flex items-baseline justify-center">
            <span className="text-8xl text-emerald-400 sm:text-9xl">
              {match.score}
            </span>
            <span className="text-4xl text-rose-500 sm:text-5xl">/</span>
            <span className="text-6xl text-rose-500 sm:text-7xl">
              {match.outs}
            </span>
          </span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          <span className="block">Score / Wickets</span>
          <strong className="block">({battingTeam.players.length})</strong>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <div
          className={`${scoreboardDisplayFont.className} ${statNumberWrapClassName} text-7xl font-bold leading-none text-white tabular-nums [font-variant-numeric:tabular-nums] sm:text-8xl`}
        >
          <span className="inline-flex items-baseline justify-center">
            {oversDisplay}
          </span>
        </div>
        <div className="text-zinc-100 text-sm uppercase tracking-wider">
          <span>
            Overs <strong>({match.overs})</strong>
          </span>
          <strong className="block">({ballsLeft})</strong>
        </div>
      </div>
    </div>
  );
}


