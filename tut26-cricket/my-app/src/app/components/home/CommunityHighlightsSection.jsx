"use client";

/**
 * File overview:
 * Purpose: UI component for Home screens and flows.
 * Main exports: CommunityHighlightsSection.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */

import { motion, useReducedMotion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import LiquidSportText from "./LiquidSportText";
import YouTubeVideoPlayer from "./YouTubeVideoPlayer";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "./useHomeDesktopReveal";

const demoVideos = [
  { videoId: "FztXLCMn0SQ", title: "GV Community Highlight 1" },
  { videoId: "foHic_QfJuU", title: "GV Community Highlight 2" },
  { videoId: "xEeLV0M78b4", title: "GV Community Highlight 3" },
  { videoId: "LlJZ0WJteSU", title: "Quick clip" },
];

export default function CommunityHighlightsSection() {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const { ref: headingRevealRef, isVisible: isHeadingVisible } = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const { ref: copyRevealRef, isVisible: isCopyVisible } = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });

  return (
    <AnimatedSection
      id="product-demo"
      direction="right"
      className="mx-auto flex w-full max-w-6xl flex-col items-center xl:max-w-7xl 2xl:max-w-[108rem]"
    >
      {useDesktopLiteMotion ? (
        <div
          ref={headingRevealRef}
          className={`mb-16 home-desktop-reveal home-desktop-reveal-sm ${
            isHeadingVisible ? "is-visible" : ""
          }`}
        >
          <LiquidSportText
            text={["From the", "Community"]}
            variant="hero-bright"
            characterTyping
            characterStagger={0.02}
            characterLineDelay={0.12}
            characterDuration={0.34}
            simplifyMotion={shouldReduceMotion}
            lightweightCharacterReveal={useDesktopLiteMotion}
            delay={0.04}
            className="text-center text-5xl font-bold tracking-tight md:text-7xl"
            lineClassName="leading-[0.96]"
          />
        </div>
      ) : (
        <motion.div
          initial={
            shouldReduceMotion
              ? false
              : { opacity: 0, y: 22, scale: 0.992, filter: "blur(6px)" }
          }
          whileInView={
            shouldReduceMotion
              ? undefined
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          }
          viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
          transition={{ duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16"
        >
          <LiquidSportText
            text={["From the", "Community"]}
            variant="hero-bright"
            characterTyping
            characterStagger={0.02}
            characterLineDelay={0.12}
            characterDuration={0.34}
            simplifyMotion={shouldReduceMotion}
            lightweightCharacterReveal={useDesktopLiteMotion}
            delay={0.04}
            className="text-center text-5xl font-bold tracking-tight md:text-7xl"
            lineClassName="leading-[0.96]"
          />
        </motion.div>
      )}
      {useDesktopLiteMotion ? (
        <p
          ref={copyRevealRef}
          className={`text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16 home-desktop-reveal home-desktop-reveal-sm ${
            isCopyVisible ? "is-visible" : ""
          }`}
        >
          GV Cricket started in 2022 with a few friends who loved the game. Today, it helps power a friendly league of more than 50 members who come together for fun, competitive cricket.
        </p>
      ) : (
        <motion.p
          initial={
            shouldReduceMotion
              ? false
              : { opacity: 0, y: 18, filter: "blur(5px)" }
          }
          whileInView={
            shouldReduceMotion
              ? undefined
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
          transition={{ duration: 0.6, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16"
        >
          GV Cricket started in 2022 with a few friends who loved the game. Today, it helps power a friendly league of more than 50 members who come together for fun, competitive cricket.
        </motion.p>
      )}
      <div
        className={`grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:gap-10 2xl:gap-12 ${
          useDesktopLiteMotion ? "home-desktop-grid-sequence" : ""
        }`}
      >
        {demoVideos.map((video) => (
          <YouTubeVideoPlayer
            key={video.videoId}
            videoId={video.videoId}
            title={video.title}
          />
        ))}
      </div>
    </AnimatedSection>
  );
}
