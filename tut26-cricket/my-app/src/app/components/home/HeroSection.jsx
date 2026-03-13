"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { FaAngleDown } from "react-icons/fa";
import LiveNowBanner from "./LiveNowBanner";

export default function HeroSection({ liveMatch = null }) {
  const sectionRef = useRef(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const logoScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.9]),
    { stiffness: 120, damping: 22, mass: 0.28 }
  );
  const logoScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 42]),
    { stiffness: 120, damping: 22, mass: 0.28 }
  );
  const headingScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.42]),
    { stiffness: 120, damping: 22, mass: 0.28 }
  );
  const headingScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 28]),
    { stiffness: 120, damping: 22, mass: 0.28 }
  );
  const headingGlowOpacity = useSpring(
    useTransform(scrollYProgress, [0, 1], [0.22, 0.48]),
    { stiffness: 120, damping: 22, mass: 0.28 }
  );

  const handleScrollToStart = () => {
    const target = document.getElementById("quick-start");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    let idleId;

    const enableVideo = () => {
      if (!cancelled) {
        setShouldLoadVideo(true);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enableVideo, { timeout: 350 });
    } else {
      timeoutId = window.setTimeout(enableVideo, 160);
    }

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (idleId && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden">
      <motion.div
        initial={{ opacity: 0.9, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="sticky top-0 flex h-screen flex-col items-center justify-center text-center"
      >
        <LiveNowBanner liveMatch={liveMatch} />
        <Image
          src="/Thumb1.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 object-cover"
        />
        {shouldLoadVideo ? (
          <video
            className="absolute inset-0 z-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/Thumb1.png"
          >
            <source src="/videos/Cricket1.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : null}
        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.56)_48%,rgba(0,0,0,0.72)_100%)]" />
        <div className="relative z-20 flex flex-col items-center px-4 pt-28 md:pt-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            className="relative"
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 scale-[1.14] rounded-full bg-[radial-gradient(circle,rgba(255,52,90,0.42)_0%,rgba(255,52,90,0.24)_24%,rgba(255,96,96,0.16)_42%,rgba(251,191,36,0.08)_58%,transparent_76%)] blur-2xl"
              animate={{
                opacity: [0.66, 1, 0.74],
                scale: [1, 1.08, 1.02],
              }}
              transition={{
                duration: 3.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              style={{ scale: logoScrollScale, y: logoScrollY }}
              className="relative will-change-transform"
            >
              <motion.div
                animate={{
                  scale: [1, 1.035, 1],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 4.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative"
              >
                <Image
                  src="/gvLogo.png"
                  alt="GV Cricket logo"
                  width={500}
                  height={400}
                  priority
                  className="mb-5 h-auto w-[340px] max-w-[88vw] object-contain md:w-[520px]"
                />
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            className="relative mt-3"
          >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-24 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(251,191,36,0.08)_30%,rgba(244,114,182,0.06)_54%,transparent_78%)] blur-3xl"
              style={{ opacity: headingGlowOpacity }}
            />
            <motion.span
              aria-hidden="true"
              style={{ scale: headingScrollScale, y: headingScrollY }}
              className="pointer-events-none absolute inset-0 z-0 block text-center text-5xl font-semibold tracking-tight text-white/12 blur-[10px] md:text-7xl"
            >
              End-to-end cricket scoring, made simple.
            </motion.span>
            <motion.span
              style={{
                scale: headingScrollScale,
                y: headingScrollY,
              }}
              className="
                relative z-10 block
                text-white/88
                text-5xl md:text-7xl font-semibold tracking-tight will-change-transform
                drop-shadow-[0_10px_30px_rgba(0,0,0,0.62)]
              "
            >
              <span className="relative inline-block">
                <span className="relative z-10">
                  End-to-end cricket scoring, made simple.
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 animate-[animate-gradient_3.8s_linear_infinite] bg-[linear-gradient(110deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.12)_24%,rgba(255,247,214,0.55)_38%,rgba(255,255,255,0.16)_54%,rgba(255,255,255,0)_72%)] bg-[length:240%_auto] bg-clip-text text-transparent mix-blend-screen"
                >
                  End-to-end cricket scoring, made simple.
                </span>
              </span>
            </motion.span>
          </motion.h1>
        </div>
        <motion.button
          type="button"
          onClick={handleScrollToStart}
          aria-label="Scroll down to the main actions"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease: "easeOut" }}
          className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-white outline-none transition hover:text-white focus-visible:text-white"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            Explore more
          </span>
          <motion.span
            animate={{ y: [0, 5, 0], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/24 bg-white/12 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-md"
          >
            <FaAngleDown className="text-lg" />
          </motion.span>
        </motion.button>
      </motion.div>
    </section>
  );
}
