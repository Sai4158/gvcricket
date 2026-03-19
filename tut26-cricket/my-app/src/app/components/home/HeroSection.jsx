"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { FaAngleDown } from "react-icons/fa";
import LiveNowBanner from "./LiveNowBanner";
import LiquidSportText from "./LiquidSportText";

export default function HeroSection({ liveMatch = null }) {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const logoScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.42]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const logoScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 26]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.18]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 18]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingGlowOpacity = useSpring(
    useTransform(scrollYProgress, [0, 1], [0.18, 0.34]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingAuraScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.16]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );

  const handleScrollToStart = () => {
    const target = document.getElementById("quick-start");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section ref={sectionRef} className="relative h-[100svh] min-h-[100svh] overflow-hidden">
      <motion.div
        initial={{ opacity: 0.92, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 flex h-[100svh] min-h-[100svh] flex-col items-center justify-center text-center"
      >
        <LiveNowBanner liveMatch={liveMatch} />
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover bg-black"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src="/videos/Cricket1.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.56)_48%,rgba(0,0,0,0.72)_100%)]" />
        <div className="relative z-20 flex flex-col items-center px-4 pt-24 sm:pt-28 md:pt-20">
          <motion.div
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 scale-[1.14] rounded-full bg-[radial-gradient(circle,rgba(255,52,90,0.42)_0%,rgba(255,52,90,0.24)_24%,rgba(255,96,96,0.16)_42%,rgba(251,191,36,0.08)_58%,transparent_76%)] blur-2xl"
              animate={{
                opacity: [0.62, 0.9, 0.7],
                scale: [1, 1.04, 1.01],
              }}
              transition={{
                duration: 2.8,
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
                  scale: [1, 1.018, 1],
                  y: [0, -2, 0],
                }}
                transition={{
                  duration: 3.2,
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
                  className="mb-5 h-auto w-[330px] max-w-[86vw] object-contain sm:w-[400px] md:w-[580px]"
                />
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.46, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-3 max-w-[min(92vw,58rem)]"
          >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[10%] top-1/2 z-0 h-[72%] -translate-y-1/2 rounded-[32px] bg-[linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.08))] blur-2xl"
              animate={{
                opacity: [0.52, 0.66, 0.56],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 4.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-24 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(251,191,36,0.08)_30%,rgba(244,114,182,0.06)_54%,transparent_78%)] blur-3xl"
              style={{ opacity: headingGlowOpacity, scale: headingAuraScale }}
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[8%] top-1/2 z-0 h-32 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(191,219,254,0.12)_34%,rgba(125,211,252,0.08)_54%,transparent_78%)] blur-[56px]"
              animate={{
                opacity: [0.34, 0.52, 0.38],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              style={{
                scale: headingScrollScale,
                y: headingScrollY,
              }}
              className="relative z-10 will-change-transform drop-shadow-[0_12px_34px_rgba(0,0,0,0.68)]"
            >
              <LiquidSportText
                as="span"
                text={["End-to-end", "cricket scoring,", "made simple."]}
                variant="hero-bright"
                cursor={false}
                typing={false}
                characterTyping
                characterStagger={0.048}
                characterLineDelay={0.28}
                characterDuration={0.54}
                className="block text-[3rem] font-semibold tracking-[-0.058em] sm:text-[4.8rem] md:text-[6.85rem]"
                lineClassName="leading-[0.94]"
              />
            </motion.div>
          </motion.h1>
        </div>
        <motion.button
          type="button"
          onClick={handleScrollToStart}
          aria-label="Scroll down to the main actions"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
