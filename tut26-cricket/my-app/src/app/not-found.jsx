/**
 * File overview:
 * Purpose: Source module for Not Found.
 * Main exports: NotFound.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
// src/app/not-found.jsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import LiquidSportText from "./components/home/LiquidSportText";
import SiteFooter from "./components/shared/SiteFooter";

// Define animation variants for staggered appearance
const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
      staggerChildren: 0.15, // Delay children animations
    },
  },
};

// Variants for individual text elements
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// IMPORTANT: Create a motion-enhanced Link component
const MotionLink = motion.create(Link);

export default function NotFound() {
  return (
    <div
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.22),transparent_24%),linear-gradient(180deg,#09090b_0%,#000000_100%)] p-4 text-center"
    >
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, transparent 70%)",
        }}
      />

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-zinc-900/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm md:p-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="mb-2">
          <Image
            src="/gvLogo.png"
            alt="GV Cricket"
            width={560}
            height={560}
            unoptimized
            className="mx-auto h-[22rem] w-[22rem] object-contain drop-shadow-[0_0_42px_rgba(220,38,38,0.2)] sm:h-[28rem] sm:w-[28rem]"
            priority
          />
        </motion.div>

        <motion.h2
          className="mb-1 text-xs font-semibold uppercase tracking-[0.38em] text-rose-200/72"
          variants={itemVariants}
        >
          Page Not Found
        </motion.h2>

        <motion.div variants={itemVariants} className="mb-4">
          <LiquidSportText
            as="h1"
            text={["THAT PAGE", "IS OUT"]}
            variant="hero-bright"
            simplifyMotion
            className="text-5xl font-black tracking-[-0.05em] sm:text-7xl"
          />
        </motion.div>

        <motion.p
          className="mb-10 max-w-xl text-base leading-relaxed text-zinc-200 sm:text-lg"
          variants={itemVariants}
        >
          The link may be old, the match may be gone, or this page was never part of the scoreboard.
          Head back home and jump into a live match, session list, or result screen from there.
        </motion.p>

        <motion.div variants={itemVariants}>
          <MotionLink
            href="/"
            className="inline-flex items-center rounded-2xl border border-rose-300/16 bg-[linear-gradient(180deg,rgba(127,29,29,0.92),rgba(69,10,10,0.96))] px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-rose-500/35"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 20px rgba(248, 113, 113, 0.28)",
            }}
            whileTap={{ scale: 0.95 }}
            aria-label="Go back to the home page"
          >
            Back to Home
          </MotionLink>
        </motion.div>

        <motion.p
          className="mt-10 text-sm italic text-zinc-400"
          variants={itemVariants}
        >
          404
        </motion.p>
      </motion.div>
      <SiteFooter showBackToTop={false} className="relative z-10 mt-14" />
    </div>
  );
}
