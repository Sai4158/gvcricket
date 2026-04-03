"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FaBroadcastTower, FaShieldAlt } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
import {
  clearClientPinRateLimit,
  registerClientPinFailure,
  useClientPinRateLimit,
} from "../../lib/pin-attempt-client";

const THEME_STYLES = {
  sky: {
    icon: "text-sky-300",
    title: "Umpire Mode PIN",
    description: "Enter the PIN to access scoring controls.",
    button:
      "border-sky-400/20 bg-[linear-gradient(180deg,rgba(37,99,235,0.2),rgba(15,23,42,0.9))] text-sky-50 shadow-[0_16px_38px_rgba(37,99,235,0.16)] hover:border-sky-300/35 hover:bg-[linear-gradient(180deg,rgba(59,130,246,0.24),rgba(15,23,42,0.94))]",
    focus:
      "focus:border-sky-300/35 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)]",
  },
  emerald: {
    icon: "text-emerald-300",
    title: "Director Mode PIN",
    description: "Enter the director PIN to start managing this live match.",
    button:
      "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(6,24,24,0.92))] text-emerald-50 shadow-[0_16px_38px_rgba(16,185,129,0.14)] hover:border-emerald-300/35 hover:bg-[linear-gradient(180deg,rgba(52,211,153,0.2),rgba(7,32,28,0.95))]",
    focus:
      "focus:border-emerald-400/35 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.09)]",
  },
};

export default function PinModal({
  onPinSubmit,
  onExit,
  isSubmitting,
  error,
  title,
  description,
  submitLabel = "Enter",
  theme = "sky",
  mode = "umpire",
  rateLimitScope = "session-access-pin",
}) {
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRef = useRef(null);
  const styles = THEME_STYLES[theme] || THEME_STYLES.sky;
  const Icon = mode === "director" ? FaBroadcastTower : FaShieldAlt;
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
      await onPinSubmit(pin);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onExit}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-sm bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <Icon className={`mx-auto mb-4 text-5xl ${styles.icon}`} />
        <h2 className="mb-2 text-2xl font-bold text-white">{title || styles.title}</h2>
        <p className="mb-6 text-zinc-400">
          {description || styles.description}
        </p>
        <div className="space-y-4">
          <input
            ref={inputRef}
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
                handleSubmit();
              }
            }}
            placeholder="0000"
            className={`w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 ${styles.focus}`}
          />
          <LoadingButton
            type="button"
            onClick={handleSubmit}
            disabled={pin.length !== 4 || pinRateLimit.isBlocked}
            loading={isSubmitting}
            pendingLabel="Checking..."
            className={`w-full rounded-2xl border py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
          >
            {submitLabel}
          </LoadingButton>
        </div>
        {displayError ? <p className="text-red-400 text-sm mt-4">{displayError}</p> : null}
      </motion.div>
    </motion.div>
  );
}
