"use client";

import { useState } from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneVolume,
  FaTimes,
  FaUsers,
} from "react-icons/fa";

export function WalkieNotice({ notice, onDismiss }) {
  if (!notice) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
      <span>{notice}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-emerald-200 transition-colors hover:text-white"
        aria-label="Dismiss walkie notice"
      >
        <FaTimes />
      </button>
    </div>
  );
}

export function WalkieTalkButton({
  active,
  disabled,
  countdown,
  onStart,
  onStop,
  label = "Hold to talk",
}) {
  const [holding, setHolding] = useState(false);

  const startHold = async () => {
    if (disabled || active || holding) return;
    setHolding(true);
    await onStart?.();
  };

  const endHold = async () => {
    if (!holding) return;
    setHolding(false);
    await onStop?.();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={() => {
          void startHold();
        }}
        onPointerUp={() => {
          void endHold();
        }}
        onPointerLeave={() => {
          void endHold();
        }}
        onPointerCancel={() => {
          void endHold();
        }}
        className={`relative inline-flex h-24 w-24 items-center justify-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
          disabled
            ? "cursor-not-allowed border-white/5 bg-zinc-900 text-zinc-600"
            : active || holding
            ? "border-emerald-300/40 bg-emerald-500 text-black shadow-[0_18px_44px_rgba(16,185,129,0.3)]"
            : "border-white/10 bg-white/[0.06] text-zinc-100 hover:-translate-y-0.5 hover:bg-white/[0.09]"
        }`}
        aria-label={active || holding ? "Release walkie talk" : label}
      >
        <span
          className={`absolute inset-[-8px] rounded-full border transition-opacity ${
            active || holding
              ? "animate-pulse border-emerald-300/35 opacity-100"
              : "border-transparent opacity-0"
          }`}
        />
        <span className="text-[1.65rem]">
          {active || holding ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </span>
      </button>
      <div className="text-center">
        <p className="text-xs font-medium text-zinc-400">
          {active || holding ? `Live ${countdown}s` : "Hold to talk"}
        </p>
      </div>
    </div>
  );
}

export default function WalkiePanel({
  role,
  snapshot,
  notice,
  error,
  canEnable,
  canRequestEnable,
  canTalk,
  isSelfTalking,
  countdown,
  requestCooldownLeft,
  onRequestEnable,
  onToggleEnabled,
  onStartTalking,
  onStopTalking,
  onDismissNotice,
}) {
  const isUmpire = role === "umpire";
  const statusText = !snapshot?.enabled
    ? "Walkie-talkie off"
    : snapshot?.activeSpeakerRole === "umpire"
    ? "Umpire is replying"
    : snapshot?.activeSpeakerRole === "spectator"
    ? "A spectator is speaking"
    : "Ready to talk";

  return (
    <div className="space-y-4">
      <WalkieNotice notice={notice} onDismiss={onDismissNotice} />

      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
              <FaPhoneVolume />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isUmpire ? "Walkie-Talkie" : "Push to Talk"}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">{statusText}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {isUmpire
                  ? "Communicate with spectators live."
                  : "Talk directly with the umpire."}
              </p>
            </div>
          </div>
          {isUmpire ? (
            <button
              type="button"
              onClick={() => onToggleEnabled?.(!snapshot?.enabled)}
              disabled={!canEnable && !snapshot?.enabled}
              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                snapshot?.enabled
                  ? "bg-emerald-500 text-black"
                  : canEnable
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "cursor-not-allowed bg-zinc-900 text-zinc-500"
              }`}
            >
              {snapshot?.enabled ? "On" : "Off"}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FaUsers />
            {snapshot?.spectatorCount || 0} spectators
          </span>
          {snapshot?.busy ? (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-200">
              Busy
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Idle
            </span>
          )}
        </div>

        {snapshot?.activeSpeakerRole === "spectator" && isUmpire ? (
          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {snapshot.activeSpeakerName || "Spectator"} is talking.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5">
          {isUmpire || snapshot?.enabled ? (
            <WalkieTalkButton
              active={isSelfTalking}
              disabled={!canTalk}
              countdown={countdown}
              onStart={onStartTalking}
              onStop={onStopTalking}
              label={isUmpire ? "Hold to reply" : "Hold to talk"}
            />
          ) : (
            <button
              type="button"
              onClick={() => onRequestEnable?.()}
              disabled={!canRequestEnable}
              className={`inline-flex w-full items-center justify-center gap-3 rounded-[24px] px-5 py-4 text-base font-black transition-all ${
                canRequestEnable
                  ? "bg-[linear-gradient(135deg,#34d399,#14b8a6)] text-black shadow-[0_14px_36px_rgba(16,185,129,0.25)]"
                  : "cursor-not-allowed bg-zinc-900 text-zinc-500"
              }`}
            >
              <FaPhoneVolume />
              {requestCooldownLeft > 0
                ? `Request sent ${requestCooldownLeft}s`
                : "Request walkie"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
