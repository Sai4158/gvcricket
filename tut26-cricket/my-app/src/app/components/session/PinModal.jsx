"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FaShieldAlt } from "react-icons/fa";
import PinPad from "../shared/PinPad";

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
        <PinPad
          value={pin}
          onChange={setPin}
          onSubmit={handleSubmit}
          length={4}
          submitLabel="Enter"
          isSubmitting={isSubmitting}
        />
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </motion.div>
    </motion.div>
  );
}
