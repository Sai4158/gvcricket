"use client";

import { motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";

export default function CongratulationsCard({ result }) {
  const safeResult = typeof result === "string" ? result.trim() : "";
  const winnerMatch = safeResult.match(/^(.*?)\s+won by\s+/i);
  const winnerName = winnerMatch?.[1]?.trim() || "Winning Team";
  const summaryText =
    safeResult ||
    "Match complete.";

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[28px] border border-amber-200/20 bg-[linear-gradient(180deg,#f6b400_0%,#e39d00_100%)] px-6 py-8 text-center text-white shadow-[0_28px_80px_rgba(217,144,10,0.22)] sm:px-8 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
      <div className="relative z-10 mx-auto max-w-xl">
        <FaTrophy className="mx-auto mb-4 text-5xl text-yellow-100 sm:text-6xl" />
        <h2 className="text-4xl font-black tracking-[-0.04em] text-yellow-50 sm:text-5xl">
          Congratulations,
        </h2>
        <p className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
          {winnerName}
        </p>
        <p className="mt-4 text-2xl font-semibold text-yellow-50 sm:text-3xl">
          {summaryText}
        </p>
      </div>
    </motion.div>
  );
}
