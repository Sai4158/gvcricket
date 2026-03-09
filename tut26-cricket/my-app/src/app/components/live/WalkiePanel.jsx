"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function IosSwitch({ checked, onChange, disabled = false, label }) {
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

export function WalkieTalkButton({
  active,
  disabled,
  countdown,
  onStart,
  onStop,
  label = "Hold to talk",
}) {
  const [holding, setHolding] = useState(false);
  const buttonRef = useRef(null);
  const holdingRef = useRef(false);
  const pointerIdRef = useRef(null);

  const startHold = useCallback(async () => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    try {
      await onStart?.();
    } catch {
      holdingRef.current = false;
      setHolding(false);
    }
  }, [disabled, onStart]);

  const endHold = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    await onStop?.();
  }, [onStop]);

  useEffect(() => {
    const handlePointerRelease = (event) => {
      if (
        pointerIdRef.current !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }

      pointerIdRef.current = null;
      void endHold();
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [endHold]);

  useEffect(() => {
    if (!active && !holding) {
      holdingRef.current = false;
      pointerIdRef.current = null;
    }
  }, [active, holding]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onPointerDown={(event) => {
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          void startHold();
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          pointerIdRef.current = null;
          void endHold();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
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
          {active || holding ? "Live" : "Hold to talk"}
        </p>
        {active || holding ? (
          <p className="mt-1 text-[11px] text-zinc-500">{countdown}s</p>
        ) : null}
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
  const [panelMessage, setPanelMessage] = useState("");
  const isUmpire = role === "umpire";
  const isRequestNotice =
    isUmpire && typeof notice === "string" && notice.toLowerCase().includes("requested walkie-talkie");
  const statusText = !snapshot?.enabled
    ? "Walkie-talkie off"
    : snapshot?.activeSpeakerRole === "umpire"
    ? isUmpire
      ? "You are live"
      : "Umpire is live"
    : snapshot?.activeSpeakerRole === "spectator"
    ? isUmpire
      ? "Spectator is live"
      : "You are live"
    : "Walkie-talkie on";

  const handleToggle = (checked) => {
    if (isUmpire) {
      setPanelMessage("");
      onToggleEnabled?.(checked);
      return;
    }

    if (!checked) {
      return;
    }

    setPanelMessage("");
    onRequestEnable?.();
  };

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
            <IosSwitch
              checked={Boolean(snapshot?.enabled)}
              disabled={false}
              label={
                snapshot?.enabled
                  ? "Walkie-talkie on"
                  : "Turn walkie-talkie on"
              }
              onChange={handleToggle}
            />
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-center text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FaUsers />
            {snapshot?.spectatorCount || 0} spectators
          </span>
        </div>

        {snapshot?.activeSpeakerRole === "spectator" && isUmpire ? (
          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-center text-sm text-sky-100">
            {snapshot.activeSpeakerName || "Spectator"} is talking.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!error && isRequestNotice ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onToggleEnabled?.(true);
                    onDismissNotice?.();
                  }}
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black"
                >
                  Enable
                </button>
                <button
                  type="button"
                  onClick={onDismissNotice}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!error && panelMessage ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {panelMessage}
          </div>
        ) : null}

        <div className="mt-5 flex justify-center">
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
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setPanelMessage("");
                  onRequestEnable?.();
                }}
                disabled={!canRequestEnable || requestCooldownLeft > 0}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {requestCooldownLeft > 0 ? `Request sent ${requestCooldownLeft}s` : "Request umpire"}
              </button>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-400">
                Ask the umpire to enable walkie-talkie.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
