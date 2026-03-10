"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FaShieldAlt } from "react-icons/fa";

export default function PinModal({
  onPinSubmit,
  onExit,
  isSubmitting,
  error,
}) {
  const [pin, setPin] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = () => {
    onPinSubmit(pin);
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
        <FaShieldAlt className="mx-auto text-5xl text-blue-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Umpire Mode PIN</h2>
        <p className="text-zinc-400 mb-6">
          Enter the PIN to access scoring controls.
        </p>
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={pin}
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
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-blue-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || pin.length !== 4}
            className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Checking..." : "Enter"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </motion.div>
    </motion.div>
  );
}
