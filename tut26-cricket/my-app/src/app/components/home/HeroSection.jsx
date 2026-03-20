"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { FaAngleDown } from "react-icons/fa";
import LiveNowBanner from "./LiveNowBanner";
import LiquidSportText from "./LiquidSportText";

const HERO_VIDEO_PATH = "/videos/Cricket1.mp4";
const HERO_VIDEO_CACHE_NAME = "gv-home-media-v1";

let cachedHeroVideoUrl = null;
let cachedHeroVideoPromise = null;

async function loadHeroVideoUrl() {
  if (cachedHeroVideoUrl) {
    return cachedHeroVideoUrl;
  }

  if (cachedHeroVideoPromise) {
    return cachedHeroVideoPromise;
  }

  cachedHeroVideoPromise = (async () => {
    try {
      let response = null;

      if (typeof window !== "undefined" && "caches" in window) {
        const mediaCache = await window.caches.open(HERO_VIDEO_CACHE_NAME);
        response = await mediaCache.match(HERO_VIDEO_PATH);

        if (!response) {
          const fetchedResponse = await fetch(HERO_VIDEO_PATH, {
            cache: "force-cache",
          });

          if (fetchedResponse.ok) {
            await mediaCache.put(HERO_VIDEO_PATH, fetchedResponse.clone());
            response = fetchedResponse;
          }
        }
      }

      if (!response) {
        response = await fetch(HERO_VIDEO_PATH, {
          cache: "force-cache",
        });
      }

      if (!response?.ok) {
        throw new Error(`Hero video request failed: ${response?.status || "unknown"}`);
      }

      const blob = await response.blob();
      cachedHeroVideoUrl = URL.createObjectURL(blob);
      return cachedHeroVideoUrl;
    } catch {
      cachedHeroVideoUrl = HERO_VIDEO_PATH;
      return HERO_VIDEO_PATH;
    } finally {
      cachedHeroVideoPromise = null;
    }
  })();

  return cachedHeroVideoPromise;
}

export default function HeroSection({ liveMatch = null }) {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [heroLines, setHeroLines] = useState([
    "End-to-end",
    "cricket scoring,",
    "made simple.",
  ]);
  const [videoSource, setVideoSource] = useState(cachedHeroVideoUrl);
  const [videoReady, setVideoReady] = useState(false);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const logoScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.1]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const logoScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 12]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingScrollScale = useSpring(
    useTransform(scrollYProgress, [0, 1], [1, 1.04]),
    { stiffness: 180, damping: 30, mass: 0.22 }
  );
  const headingScrollY = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, 8]),
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

  useEffect(() => {
    const xlQuery = window.matchMedia("(min-width: 1024px)");

    const syncHeroLines = () => {
      if (xlQuery.matches) {
        setHeroLines(["End-to-end cricket scoring,", "made simple."]);
        return;
      }

      setHeroLines(["End-to-end", "cricket scoring,", "made simple."]);
    };

    syncHeroLines();
    xlQuery.addEventListener("change", syncHeroLines);

    return () => {
      xlQuery.removeEventListener("change", syncHeroLines);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadHeroVideoUrl().then((resolvedUrl) => {
      if (!isMounted) {
        return;
      }

      setVideoSource(resolvedUrl);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoSource) {
      return undefined;
    }

    let isMounted = true;

    const markReady = () => {
      if (!isMounted) return;
      setVideoReady(true);
    };

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    if (video.readyState >= 2) {
      markReady();
    }

    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("canplaythrough", markReady);
    video.addEventListener("playing", markReady);

    video.load();
    tryPlay();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("canplaythrough", markReady);
      video.removeEventListener("playing", markReady);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [videoSource]);

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
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_24%),linear-gradient(180deg,rgba(7,8,10,0.92),rgba(0,0,0,0.98))]" />
        {videoSource ? (
          <video
            ref={videoRef}
            src={videoSource}
            className={`absolute inset-0 z-0 h-full w-full object-cover bg-black transition-opacity duration-500 [backface-visibility:hidden] [transform:translateZ(0)] will-change-transform ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
          >
            Your browser does not support the video tag.
          </video>
        ) : null}
        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.56)_48%,rgba(0,0,0,0.72)_100%)]" />
        <div className="relative z-20 flex flex-col items-center px-4 pt-24 sm:pt-28 md:pt-18 lg:pt-16">
          <motion.div
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 scale-[1.14] rounded-full bg-[radial-gradient(circle,rgba(255,52,90,0.42)_0%,rgba(255,52,90,0.24)_24%,rgba(255,96,96,0.16)_42%,rgba(251,191,36,0.08)_58%,transparent_76%)] blur-2xl"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: [0.52, 0.68, 0.58],
                      scale: [1, 1.015, 1],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 8.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
            <motion.div
              style={{ scale: logoScrollScale, y: logoScrollY }}
              className="relative will-change-transform"
            >
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        scale: [1, 1.006, 1],
                        y: [0, -0.5, 0],
                      }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : {
                        duration: 9,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
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
            className="relative mt-3 max-w-[min(92vw,58rem)] lg:max-w-[min(92vw,70rem)] 2xl:max-w-[min(94vw,88rem)]"
          >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[10%] top-1/2 z-0 h-[72%] -translate-y-1/2 rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.2),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.06))] blur-2xl"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: [0.38, 0.5, 0.42],
                      scale: [1, 1.01, 1],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 8.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-24 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(251,191,36,0.12)_26%,rgba(244,114,182,0.12)_46%,rgba(56,189,248,0.12)_64%,transparent_82%)] blur-3xl"
              style={{ opacity: headingGlowOpacity, scale: headingAuraScale }}
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[8%] top-1/2 z-0 h-32 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0%,rgba(191,219,254,0.14)_26%,rgba(99,102,241,0.1)_42%,rgba(244,114,182,0.12)_58%,transparent_82%)] blur-[56px]"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: [0.22, 0.34, 0.26],
                      scale: [1, 1.02, 1],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 9.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[16%] top-[58%] z-0 h-6 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(244,114,182,0),rgba(244,114,182,0.24),rgba(251,191,36,0.28),rgba(56,189,248,0.24),rgba(244,114,182,0))] blur-xl"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: [0.1, 0.18, 0.12],
                      scaleX: [0.99, 1.015, 1],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 9.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
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
                text={heroLines}
                variant="hero-bright"
                cursor={false}
                typing={false}
                characterTyping
                lineWave
                lineWaveAmount={2.4}
                lineWaveRotate={0.45}
                lineWaveDuration={7.6}
                characterStagger={0.048}
                characterLineDelay={0.28}
                characterDuration={0.54}
                className="block text-[3rem] font-semibold tracking-[-0.058em] sm:text-[4.8rem] md:text-[5.9rem] lg:text-[5.6rem] xl:text-[6.2rem] 2xl:text-[6.85rem]"
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
          className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-white outline-none transition hover:text-white focus-visible:text-white md:bottom-10 lg:bottom-12"
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
