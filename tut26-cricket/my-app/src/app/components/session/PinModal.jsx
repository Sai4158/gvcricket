"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FaShieldAlt } from "react-icons/fa";

export default function PinModal({
  onPinSubmit,
  onExit,
  isSubmitting,
  error,
}) {
  const [pin, setPin] = useState("");

  const handleSubmit = () => {
    onPinSubmit(pin);
  };

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
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          maxLength={8}
          className="w-full p-4 text-center text-2xl tracking-[1rem] rounded-lg bg-zinc-800 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white placeholder:text-zinc-500 transition"
          placeholder="----"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full mt-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-60"
        >
          {isSubmitting ? "Checking..." : "Enter"}
        </button>
      </motion.div>
    </motion.div>
  );
}
