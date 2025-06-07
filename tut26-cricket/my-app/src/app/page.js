/* src/app/page.js */
"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  FaUsers,
  FaPlusCircle,
  FaListAlt,
  FaCoins,
  FaPenSquare,
  FaEye,
  FaCheckCircle,
} from "react-icons/fa";

// A section component that fades and slides in as it enters the viewport
const AnimatedSection = ({ children, className }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
    once: true, // Animation runs only once
  });

  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.6], [100, 0]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
};

export default function HomePage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Hero parallax animations
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <>
      {/* Main Content */}
      <main className="bg-black text-zinc-200 font-sans">
        {/* --- Hero Section --- */}
        {/* FIX: Added overflow-hidden to the parent section to contain the scaling animation. */}
        <section ref={heroRef} className="h-screen relative overflow-hidden">
          <motion.div
            style={{ scale: heroScale, opacity: heroOpacity }}
            className="sticky top-0 h-screen flex flex-col items-center justify-center text-center"
          >
            <div className="absolute inset-0 bg-black/70 z-10" />
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              poster="/Thumb1.png"
            >
              <source src="/videos/Cricket1.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="relative z-20 flex flex-col items-center px-4">
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
              >
                <Image
                  src="/gvLogo.png"
                  alt="GV Cricket logo"
                  width={140}
                  height={140}
                  priority
                  className="h-44 w-44 object-contain drop-shadow-[0_5px_35px_rgba(255,100,120,0.8)] rounded-full mb-6"
                />
              </motion.div>
              <motion.h1
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
                className="text-6xl md:text-8xl font-extrabold tracking-tight
                bg-clip-text text-transparent
                bg-gradient-to-r from-yellow-200 via-rose-200 to-orange-300"
              >
                The Home of GV Cricket.
              </motion.h1>
            </div>
          </motion.div>
        </section>

        {/* --- Post-Hero Content Wrapper --- */}
        <div className="relative z-10 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] py-24 md:py-32 px-5 space-y-24 md:space-y-40">
          {/* --- Intro & CTA Buttons Section --- */}
          <section className="w-full max-w-3xl mx-auto flex flex-col items-center gap-12 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                Built for the Community, by the Community.
              </h2>
              <p className="text-lg text-zinc-300 leading-relaxed">
                It all started in 2022 with a few friends who loved the game.
                Today, we're a friendly league of over{" "}
                <strong className="text-white">50+ members</strong> who meet for
                fun, competitive cricket. This app is our custom built tool to
                make scoring simple, fast, and accessible to everyone in{" "}
                <strong className="text-white">real time.</strong>
              </p>
            </div>
            <div className="w-full max-w-md flex flex-col gap-5">
              <Link
                href="/session/new"
                className=" text-center py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 text-black text-2xl font-bold shadow-lg shadow-amber-900/40 hover:scale-105 transition-transform"
              >
                Launch Umpire <br />
                Mode
              </Link>
              <Link
                href="/session"
                className="text-center py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300 text-black text-2xl font-bold shadow-lg shadow-amber-900/40 hover:scale-105 transition-transform"
              >
                View Past/Live <br /> Sessions
              </Link>
              <Link
                href="/rules"
                className="text-center  py-4 rounded-2xl bg-zinc-700 text-white/80 text-2xl font-bold ring-1 ring-zinc-700 hover:bg-zinc-700 hover:text-white transition hover:scale-105 transition-transform"
              >
                View All Rules!
              </Link>
            </div>
          </section>

          {/* --- How The App Works Section --- */}
          {/* FIX: Added overflow-hidden as a safety measure for the content inside. */}
          <AnimatedSection className="w-full max-w-6xl mx-auto overflow-hidden">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-12 space-y-12 ring-1 ring-white/10 shadow-2xl shadow-black/40">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300">
                  How This App Works 🏏
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-xl text-white">
                  Say goodbye to memorizing. <br />
                  <br />
                  This is a real time scoring tool designed for our games,
                  perfect for practice matches, league play, or just having fun
                  with friends.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
                {/* Step 1 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaListAlt className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Session Dashboard
                  </h3>
                  <p className="text-gray">
                    Your central hub to see all past games, create new ones, or
                    jump back into a <b>unfinished</b> match with a secure
                    Umpire PIN.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaPenSquare className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Live Umpire Scoring
                  </h3>
                  <p className="text-gray">
                    The umpire's cockpit. Score every ball with simple, color
                    coded buttons for runs, wides, dots, and outs.
                  </p>
                </div>
                {/* Step 5 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaEye className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Spectator View
                  </h3>
                  <p className="text-gray">
                    Share the live scoreboard! <br />
                    <br />
                    Perfect for friends to follow along or for displaying the
                    score on a big screen during a game. <br /> <br />
                    You can instantly see if the session is live or completed.
                    live matches show a red pulse, and finished ones show green.
                  </p>
                </div>
                {/* Step 2 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaPlusCircle className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    New Match Setup
                  </h3>
                  <p className="text-gray">
                    Start a game in seconds. Just enter a match name, add
                    players to Team A & B, and pick the number of overs.
                  </p>
                </div>
                {/* Step 3 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaCoins className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Animated Coin Toss
                  </h3>
                  <p className="text-gray">
                    To make it official! A fun coin flip animation decides who
                    bats first, then automatically starts the match.
                  </p>
                </div>
                {/* Step 6 */}
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaCheckCircle className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Final Results
                  </h3>
                  <p className="text-gray">
                    Get an instant summary showing who won, the final scores,
                    and key stats. All games are saved in the cloud for you to
                    review later.
                  </p>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* --- Video Gallery Section --- */}
          {/* FIX: Added overflow-hidden as a safety measure for the content inside. */}
          <AnimatedSection className="w-full max-w-6xl mx-auto flex flex-col items-center overflow-hidden">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-16 text-center text-white">
              From Our Community
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { clip: "Cricket1", thumb: "Thumb1" },
                { clip: "Cricket4", thumb: "Thumb4" },
                { clip: "Cricket2", thumb: "Thumb2" },
                { clip: "Cricket3", thumb: "Thumb3" },
              ].map((video, i) => (
                <figure
                  key={video.clip}
                  className="overflow-hidden rounded-3xl ring-1 ring-white/10
                    bg-white/5 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col group hover:ring-white/20 transition"
                >
                  <video
                    className="w-full h-auto aspect-video"
                    controls
                    preload="metadata"
                    poster={`/${video.thumb}.png`}
                  >
                    <source
                      src={`/videos/${video.clip}.mp4`}
                      type="video/mp4"
                    />
                    Sorry, your browser doesn’t support embedded videos.
                  </video>
                  <figcaption className="p-4 text-center font-medium text-zinc-300 group-hover:text-amber-300 transition-colors">
                    Highlight {i + 1}
                  </figcaption>
                </figure>
              ))}
            </div>
          </AnimatedSection>

          {/* --- Footer --- */}
          <footer className="text-center pt-24 pb-12 border-t border-white/10">
            <p className="text-zinc-400">
              &copy; 2025 GV Cricket. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
