"use client";

/**
 * File overview:
 * Purpose: UI component for Result screens and flows.
 * Main exports: CongratulationsCard.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */

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
      className="relative overflow-hidden rounded-[28px] border border-amber-200/20 bg-[linear-gradient(180deg,#f6b400_0%,#e39d00_100%)] px-6 py-8 text-white shadow-[0_28px_80px_rgba(217,144,10,0.22)] sm:px-8 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
      <div className="relative z-10 mx-auto max-w-[22rem] text-center">
        <FaTrophy className="mx-auto mb-4 text-5xl text-yellow-50 sm:text-6xl" />
        <h2 className="mx-auto max-w-[12ch] text-[2rem] font-black uppercase leading-[0.95] tracking-[-0.05em] text-white [text-shadow:0_1px_0_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.12)] sm:text-[2.65rem]">
          Congratulations
        </h2>
        <p className="mx-auto mt-3 max-w-[10ch] text-[2.15rem] font-black uppercase leading-[0.95] tracking-[-0.05em] text-rose-100 [text-shadow:0_1px_0_rgba(255,255,255,0.18),0_0_20px_rgba(251,113,133,0.2)] sm:text-[3rem]">
          {winnerName}
        </p>
        <p className="mt-4 text-center text-2xl font-semibold text-white/95 sm:text-3xl">
          {summaryText}
        </p>
      </div>
    </motion.div>
  );
}
