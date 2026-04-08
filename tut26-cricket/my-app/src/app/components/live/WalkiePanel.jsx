"use client";

/**
 * File overview:
 * Purpose: UI component for Live screens and flows.
 * Main exports: WalkiePanel, WalkieNotice, WalkieRequestQueue, WalkieTalkButton.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaLock,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneVolume,
  FaUsers,
} from "react-icons/fa";
import { getWalkieRemoteSpeakerState, getWalkieRoleLabel } from "../../lib/walkie-ui";
import LiquidLoader from "../shared/LiquidLoader";
import ModalGradientTitle from "../shared/ModalGradientTitle";

function WalkieInlineTalkButton({
  active = false,
  finishing = false,
  pending = false,
  countdown = 0,
  finishDelayLeft = 0,
  onPrepare,
  onStart,
  onStop,
}) {
  const [starting, setStarting] = useState(false);
  const holdingRef = useRef(false);
  const pointerIdRef = useRef(null);
  const startAttemptRef = useRef(0);

  const startHold = useCallback(async () => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setStarting(true);
    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;
    try {
      const prepared = await onPrepare?.();
      if (!holdingRef.current || startAttemptRef.current !== attemptId || prepared === false) {
        holdingRef.current = false;
        setStarting(false);
        return;
      }
      const started = (await onStart?.()) !== false;
      if (!holdingRef.current || startAttemptRef.current !== attemptId || !started) {
        if (!holdingRef.current && started) {
          await onStop?.();
        }
        holdingRef.current = false;
        setStarting(false);
        return;
      }
    } catch {
      holdingRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [onPrepare, onStart, onStop]);

  const endHold = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setStarting(false);
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
    if (!active && !starting) {
      holdingRef.current = false;
      pointerIdRef.current = null;
    }
  }, [active, starting]);

  const live = active || finishing;
  const pendingState = pending || (starting && !live);

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (!event.isPrimary) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        void startHold();
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        pointerIdRef.current = null;
        void endHold();
      }}
      onPointerCancel={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        pointerIdRef.current = null;
        void endHold();
      }}
      onLostPointerCapture={() => {
        pointerIdRef.current = null;
        void endHold();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      className={`inline-flex min-w-[154px] touch-none select-none items-center justify-center gap-2 rounded-full px-2 py-2 text-xs font-semibold transition ${
        live
          ? "bg-[linear-gradient(135deg,#d1fae5_0%,#34d399_35%,#10b981_100%)] text-black shadow-[0_14px_34px_rgba(16,185,129,0.28)]"
          : pendingState
          ? "border border-cyan-300/30 bg-cyan-500/12 text-cyan-50 shadow-[0_14px_34px_rgba(34,211,238,0.18)]"
          : "border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-emerald-200/28 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]"
      }`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "none",
      }}
      draggable={false}
      aria-label={live ? "Release walkie talk" : "Hold to talk"}
    >
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          live
            ? "bg-black/12"
            : pendingState
            ? "bg-cyan-400/12 text-cyan-100"
            : "bg-emerald-400/12 text-emerald-200"
        }`}
      >
        <FaMicrophone className="text-[0.82rem]" />
      </span>
      <span className="whitespace-nowrap">
        {finishing
          ? "Live"
          : active
          ? "Live"
          : pendingState
          ? "Talk"
          : "Talk"}
      </span>
    </button>
  );
}

export function WalkieNotice({
  notice,
  onDismiss,
  embedded = false,
  attention = false,
  quickTalkEnabled = false,
  quickTalkActive = false,
  quickTalkPending = false,
  quickTalkFinishing = false,
  quickTalkCountdown = 0,
  quickTalkFinishDelayLeft = 0,
  onQuickTalkPrepare,
  onQuickTalkStart,
  onQuickTalkStop,
}) {
  const attentionMode =
    attention === true
      ? "flash-pulse"
      : typeof attention === "string"
      ? attention
      : "idle";
  const attentionActive =
    attentionMode !== "idle" &&
    attentionMode !== "off" &&
    attentionMode !== "none" &&
    Boolean(attentionMode);
  const displayNotice =
    notice ||
    (quickTalkEnabled
      ? quickTalkPending
        ? "Connecting live channel..."
        : quickTalkActive
        ? `Live on. ${quickTalkCountdown || 0}s running.`
        : quickTalkFinishing
        ? `Connected. ${quickTalkFinishDelayLeft || 1}s left.`
        : "Connection live. Speak after short beep."
      : "");
  if (!displayNotice && !quickTalkEnabled) return null;

  const attentionClasses = attentionActive
    ? "border-emerald-200/45 bg-emerald-400/18 shadow-[0_0_0_1px_rgba(167,243,208,0.16),0_0_34px_rgba(16,185,129,0.2)]"
    : "border-emerald-500/20 bg-emerald-500/10";
  const attentionStyle = attentionActive
    ? {
        animation:
          "pulse 850ms cubic-bezier(0.16,1,0.3,1) 0s 1, pulse 3.2s ease-in-out 900ms infinite",
      }
    : undefined;

  return (
    <div
      className={`${embedded ? "" : "mb-4 "}flex select-none items-start justify-between gap-3 rounded-2xl border px-4 py-3 ${quickTalkEnabled ? "text-[13px]" : "text-sm"} text-emerald-100 ${
        attentionClasses
      }`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        ...attentionStyle,
      }}
    >
      <div className="min-w-0 flex-1">
        {quickTalkEnabled ? (
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/16 bg-black/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-50">
            <FaLock className="shrink-0" />
            <span className="select-none">Live Channel</span>
          </div>
        ) : null}
        <span className={`block min-w-0 [overflow-wrap:anywhere] ${quickTalkEnabled ? "leading-5" : ""}`}>
          {displayNotice}
        </span>
      </div>
      {quickTalkEnabled ? (
        <WalkieInlineTalkButton
          active={quickTalkActive}
          pending={quickTalkPending}
          finishing={quickTalkFinishing}
          countdown={quickTalkCountdown}
          finishDelayLeft={quickTalkFinishDelayLeft}
          onPrepare={onQuickTalkPrepare}
          onStart={onQuickTalkStart}
          onStop={onQuickTalkStop}
        />
      ) : null}
    </div>
  );
}

export function WalkieRequestQueue({
  requests = [],
  onAccept,
  onDismiss,
}) {
  if (!requests.length) return null;

  return (
    <div className="mt-4 space-y-3">
      {requests.map((request) => (
        <div
          key={request.requestId}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                  {getWalkieRoleLabel(request.role)}
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                {request.name} wants to use walkie-talkie.
              </p>
            </div>
          </div>
          <div
            className={`mt-4 grid gap-3 ${
              request.role === "spectator" ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            <button
              type="button"
              onClick={() => onAccept?.(request.requestId)}
              className="flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_14px_34px_rgba(16,185,129,0.24)] transition hover:bg-emerald-400"
            >
              Accept
            </button>
            {request.role !== "spectator" ? (
              <button
                type="button"
                onClick={() => onDismiss?.(request.requestId)}
                className="flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function roleLabel(role) {
  return getWalkieRoleLabel(role);
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
  finishing = false,
  pending = false,
  size = "md",
  disabled,
  countdown,
  finishDelayLeft = 0,
  onPrepare,
  onStart,
  onStop,
  label = "Hold to talk",
}) {
  const [starting, setStarting] = useState(false);
  const buttonRef = useRef(null);
  const holdingRef = useRef(false);
  const pointerIdRef = useRef(null);

  const startHold = useCallback(async () => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setStarting(true);
    try {
      const prepared = await onPrepare?.();
      if (!holdingRef.current || prepared === false) {
        holdingRef.current = false;
        return;
      }
      const started = (await onStart?.()) !== false;
      if (!holdingRef.current || !started) {
        if (!holdingRef.current && started) {
          await onStop?.();
        }
        holdingRef.current = false;
      }
    } catch {
      holdingRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [disabled, onPrepare, onStart, onStop]);

  const endHold = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setStarting(false);
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
    if (!active && !starting) {
      holdingRef.current = false;
      pointerIdRef.current = null;
    }
  }, [active, starting]);

  const live = active || finishing;
  const pendingState = pending || starting;

  return (
    <div
      className="flex select-none flex-col items-center gap-3"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onPointerDown={(event) => {
          if (!event.isPrimary) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          void startHold();
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          pointerIdRef.current = null;
          void endHold();
        }}
        onPointerCancel={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          pointerIdRef.current = null;
          void endHold();
        }}
        onLostPointerCapture={() => {
          pointerIdRef.current = null;
          void endHold();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onDragStart={(event) => {
          event.preventDefault();
        }}
        className={`relative inline-flex touch-none select-none items-center justify-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
          disabled
            ? "cursor-not-allowed border-white/5 bg-zinc-900 text-zinc-600"
            : live
            ? "border-emerald-300/40 bg-emerald-500 text-black shadow-[0_18px_44px_rgba(16,185,129,0.3)]"
            : pendingState
            ? "border-cyan-300/35 bg-cyan-500/10 text-cyan-100 shadow-[0_14px_34px_rgba(34,211,238,0.18)]"
            : "border-white/10 bg-white/[0.06] text-zinc-100 hover:-translate-y-0.5 hover:bg-white/[0.09]"
        } ${size === "lg" ? "h-28 w-28" : "h-24 w-24"}`}
        aria-label={live ? "Release walkie talk" : label}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        draggable={false}
      >
        <span
          className={`absolute inset-[-8px] rounded-full border transition-opacity ${
            live
              ? "animate-pulse border-emerald-300/35 opacity-100"
              : pendingState
              ? "animate-pulse border-cyan-300/25 opacity-100"
              : "border-transparent opacity-0"
          }`}
        />
        <span className={size === "lg" ? "text-[2rem]" : "text-[1.65rem]"}>
          {live ? (
            <FaMicrophone />
          ) : pendingState ? (
            <FaMicrophone className="animate-pulse" />
          ) : (
            <FaMicrophoneSlash />
          )}
        </span>
      </button>
      <div
        className="select-none text-center"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p className="text-xs font-medium text-zinc-400">
          {finishing
            ? "Finishing"
            : active
            ? "Live"
            : pendingState
            ? "Connecting"
            : "Hold to talk"}
        </p>
        {finishing ? (
          <p className="mt-1 text-[11px] text-zinc-500">{finishDelayLeft || 1}s</p>
        ) : active ? (
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
  talkPathPrimed = false,
  isSelfTalking,
  isFinishing,
  claiming = false,
  preparingToTalk = false,
  updatingEnabled = false,
  recoveringAudio = false,
  recoveringSignaling = false,
  countdown,
  finishDelayLeft,
  requestCooldownLeft,
  requestState = "idle",
  needsAudioUnlock = false,
  pendingRequests = [],
  onRequestEnable,
  onToggleEnabled,
  onStartTalking,
  onStopTalking,
  onDismissNotice,
  onUnlockAudio,
  onPrepareTalking,
  onAcceptRequest,
  onDismissRequest,
}) {
  const isUmpire = role === "umpire";
  const spectatorCount = Number(snapshot?.spectatorCount || 0);
  const directorCount = Number(snapshot?.directorCount || 0);
  const hasRemoteAudience = spectatorCount + directorCount > 0;
  const walkieRecovering = Boolean(recoveringAudio || recoveringSignaling);
  const walkieActionPending = Boolean(
    updatingEnabled || (!talkPathPrimed && (claiming || preparingToTalk))
  );
  const remoteSpeakerState = getWalkieRemoteSpeakerState({
    snapshot,
    isSelfTalking,
  });
  const effectiveCanTalk = Boolean(canTalk && (!isUmpire || hasRemoteAudience));
  const canShowRequestAction = !snapshot?.enabled && !isUmpire;
  const statusText = walkieActionPending
    ? "Connecting"
    : walkieRecovering
    ? "Reconnecting"
    : remoteSpeakerState.isRemoteTalking
    ? remoteSpeakerState.shortStatus
    : !snapshot?.enabled
    ? "Walkie-talkie is off"
    : isFinishing
    ? "Finishing"
    : isSelfTalking
    ? "You are live"
    : isUmpire && !hasRemoteAudience
    ? "Waiting for spectators"
    : "Ready";
  const activeSpeakerLabel = snapshot?.activeSpeakerName
    ? `${snapshot.activeSpeakerName}${
        snapshot?.activeSpeakerRole && !isSelfTalking ? ` • ${roleLabel(snapshot.activeSpeakerRole)}` : ""
      }`
    : snapshot?.activeSpeakerRole
    ? roleLabel(snapshot.activeSpeakerRole)
    : "";
  const activeSpeakerLabelText = snapshot?.activeSpeakerName
    ? `${snapshot.activeSpeakerName}${
        snapshot?.activeSpeakerRole && !isSelfTalking
          ? ` • ${getWalkieRoleLabel(snapshot.activeSpeakerRole)}`
          : ""
      }`
    : snapshot?.activeSpeakerRole
    ? getWalkieRoleLabel(snapshot.activeSpeakerRole)
    : "";

  const safeActiveSpeakerLabel = snapshot?.activeSpeakerName
    ? `${snapshot.activeSpeakerName}${
        snapshot?.activeSpeakerRole && !isSelfTalking
          ? ` - ${roleLabel(snapshot.activeSpeakerRole)}`
          : ""
      }`
    : snapshot?.activeSpeakerRole
    ? roleLabel(snapshot.activeSpeakerRole)
    : "";
  const safeActiveSpeakerLabelText = snapshot?.activeSpeakerName
    ? `${snapshot.activeSpeakerName}${
        snapshot?.activeSpeakerRole && !isSelfTalking
          ? ` - ${getWalkieRoleLabel(snapshot.activeSpeakerRole)}`
          : ""
      }`
    : snapshot?.activeSpeakerRole
    ? getWalkieRoleLabel(snapshot.activeSpeakerRole)
    : "";

  const handleToggle = (checked) => {
    if (isUmpire) {
      onToggleEnabled?.(checked);
      return;
    }

    if (!checked) {
      return;
    }

    onRequestEnable?.();
  };

  const requestButtonLabel =
    requestState === "pending"
      ? requestCooldownLeft > 0
        ? `Request sent ${requestCooldownLeft}s`
        : "Request sent"
      : requestState === "dismissed"
      ? "Request again"
      : "Request walkie";

  const helperText =
    requestState === "pending"
      ? "Waiting for the umpire."
      : requestState === "dismissed"
      ? "The umpire dismissed the request."
      : "Ask the umpire to turn on walkie-talkie.";

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
        <div className="min-h-[72px]">
          <WalkieNotice embedded notice={notice} onDismiss={onDismissNotice} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
              <FaPhoneVolume />
            </div>
            <div>
              <ModalGradientTitle
                as="h3"
                text={isUmpire ? "Walkie-Talkie" : "Push to Talk"}
                className="text-lg"
              />
              <p className="mt-1 text-sm text-zinc-400">{statusText}</p>
              {snapshot?.enabled && safeActiveSpeakerLabelText && !isSelfTalking ? (
                <>
                <p className="sr-only" title={safeActiveSpeakerLabel}>
                  Live now: {activeSpeakerLabelText.replace("â€¢", "•")}
                </p>
                <p className="mt-1 text-xs font-medium text-emerald-200" title={safeActiveSpeakerLabel}>
                  Live now: {safeActiveSpeakerLabelText}
                </p>
                </>
              ) : null}
              <p className="mt-1 text-xs text-zinc-500">
                {isUmpire
                  ? hasRemoteAudience
                    ? "Talk with spectators and the director."
                    : "Wait for a spectator or director to join."
                  : role === "director"
                  ? "Talk with the umpire or spectators."
                  : "Talk with the umpire or spectators."}
              </p>
            </div>
          </div>
          {isUmpire ? (
            <IosSwitch
              checked={Boolean(snapshot?.enabled)}
              disabled={updatingEnabled}
              label={
                snapshot?.enabled
                  ? "Walkie-talkie is on"
                  : "Turn walkie-talkie on"
              }
              onChange={handleToggle}
            />
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-center text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FaUsers />
            {spectatorCount} spectator{spectatorCount === 1 ? "" : "s"}
          </span>
          {directorCount > 0 ? (
            <span className="ml-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <FaPhoneVolume />
              {directorCount} director{directorCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {isUmpire ? (
          <WalkieRequestQueue
            requests={pendingRequests}
            onAccept={onAcceptRequest}
            onDismiss={onDismissRequest}
          />
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {needsAudioUnlock ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
            <p>Safari needs one tap to enable walkie audio on this device.</p>
            <button
              type="button"
              onClick={() => onUnlockAudio?.()}
              className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Enable Audio
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex justify-center">
          {isUmpire || snapshot?.enabled ? (
            remoteSpeakerState.isRemoteTalking ? (
              <div className="w-full max-w-[320px] rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.92),rgba(8,10,16,0.98))] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                <div className="mb-2 inline-flex items-center rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  {remoteSpeakerState.capsuleLabel}
                </div>
                <p className="text-sm font-medium text-white">{remoteSpeakerState.title}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{remoteSpeakerState.detail}</p>
              </div>
            ) : (
              <WalkieTalkButton
                active={isSelfTalking}
                finishing={isFinishing}
                pending={walkieActionPending || walkieRecovering}
                size={role === "spectator" ? "lg" : "md"}
                disabled={!effectiveCanTalk || walkieRecovering}
                countdown={countdown}
                finishDelayLeft={finishDelayLeft}
                onPrepare={onPrepareTalking}
                onStart={onStartTalking}
                onStop={onStopTalking}
                label={isUmpire ? "Hold to reply" : "Hold to talk"}
              />
            )
          ) : canShowRequestAction ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  onRequestEnable?.();
                }}
                disabled={!canRequestEnable || requestState === "pending" || walkieRecovering}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(16,185,129,0.22)] transition disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {requestState === "pending" ? (
                  <>
                    <LiquidLoader size="sm" label="Sending walkie request" className="text-current" />
                    <span>{requestButtonLabel}</span>
                  </>
                ) : (
                  requestButtonLabel
                )}
              </button>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-400">
                {requestState === "pending" ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-300">
                    <LiquidLoader size="sm" label="Waiting for the umpire" />
                    <span>{helperText}</span>
                  </div>
                ) : (
                  helperText
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-400">
              {isUmpire && snapshot?.enabled && !hasRemoteAudience
                ? "Waiting for a spectator or director to join the walkie channel."
                : "Walkie-talkie is unavailable right now."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
