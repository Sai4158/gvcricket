"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowRight, FaImage, FaTimes } from "react-icons/fa";
import LoadingButton from "./LoadingButton";

export default function ImagePinModal({
  isOpen,
  title = "Enter PIN",
  subtitle = "Enter the 6-digit PIN to continue with this image.",
  confirmLabel = "Continue",
  showContinueWithout = false,
  digitCount = 6,
  pinLabel = "6-digit PIN",
  placeholder = "- - - - - -",
  hideHeaderCopy = false,
  summaryTitle = "",
  summaryItems = [],
  onConfirm,
  onContinueWithout,
  onClose,
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setPin("");
      setError("");
      setIsSubmitting(false);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      await onConfirm?.(pin);
      setPin("");
    } catch (caughtError) {
      setError(caughtError.message || "Incorrect PIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_28%)]" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close PIN dialog"
            >
              <FaTimes />
            </button>

            <div className="relative">
              {!hideHeaderCopy ? (
                <>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/12 text-xl text-amber-300 shadow-[0_12px_24px_rgba(245,158,11,0.12)]">
                    <FaImage />
                  </div>
                  {title ? (
                    <h3 className="text-2xl font-black tracking-tight text-white">
                      {title}
                    </h3>
                  ) : null}
                  {subtitle ? (
                    <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">
                      {subtitle}
                    </p>
                  ) : null}
                </>
              ) : null}

              {summaryItems.length ? (
                <div className={`${hideHeaderCopy ? "mt-4" : "mt-5"} rounded-[22px] border border-white/8 bg-white/[0.04] p-3`}>
                  {summaryTitle ? (
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      {summaryTitle}
                    </p>
                  ) : null}
                  <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                    {summaryItems.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-100"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={hideHeaderCopy ? "mt-2" : "mt-6"}>
                {!hideHeaderCopy ? (
                  <label
                    htmlFor="image-pin-input"
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                  >
                    {pinLabel}
                  </label>
                ) : null}
                <input
                  ref={inputRef}
                  id="image-pin-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={digitCount}
                  value={pin}
                  onChange={(event) =>
                    setPin(
                      event.target.value.replace(/\D/g, "").slice(0, digitCount)
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={placeholder}
                  aria-label={pinLabel}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(251,191,36,0.08)]"
                />
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3">
                <LoadingButton
                  type="button"
                  onClick={handleSubmit}
                  disabled={pin.length !== digitCount}
                  loading={isSubmitting}
                  pendingLabel="Checking..."
                  trailingIcon={<FaArrowRight />}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#facc15_0%,#f59e0b_52%,#fb7185_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmLabel}
                </LoadingButton>
                {showContinueWithout ? (
                  <button
                    type="button"
                    onClick={onContinueWithout}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                  >
                    Continue without picture
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
