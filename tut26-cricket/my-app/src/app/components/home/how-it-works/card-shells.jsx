/**
 * File overview:
 * Purpose: Provides the reusable card shells for the home-page how-it-works previews.
 * Main exports: DesktopLiteHeadline, DesktopRevealCard, FeatureCard, FeatureCardDesktop, JourneyCard, JourneyCardDesktop.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import useHomeDesktopReveal from "../useHomeDesktopReveal";
import {
  cardVariants,
  previewItemVariants,
  previewStaggerVariants,
  previewTitleVariants,
} from "./how-it-works-motion";
import {
  getAccentRail,
  getCompactCardCopy,
  getFeatureCardWideOrder,
  getFeatureCardWideSpan,
  getJourneyCardWideSpan,
  getJourneyStepLabel,
} from "./how-it-works-utils";
import { renderFeaturePreview } from "./feature-previews";
import { renderJourneyPreview } from "./journey-previews";
function DesktopLiteHeadline({
  text,
  isVisible,
  className = "",
  lineClassName = "",
  delay = 0,
}) {
  const lines = Array.isArray(text) ? text : [text];

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(\s+)/);
        let wordIndex = 0;

        return (
          <span key={`${line}-${lineIndex}`} className={`block whitespace-pre ${lineClassName}`}>
            {parts.map((part, partIndex) => {
              if (!part) {
                return null;
              }

              if (/^\s+$/.test(part)) {
                return <span key={`${lineIndex}-space-${partIndex}`}>{part}</span>;
              }

              const wordDelayMs = Math.round(
                (delay + lineIndex * 0.16 + wordIndex * 0.08) * 1000
              );
              wordIndex += 1;

              return (
                <span
                  key={`${lineIndex}-word-${partIndex}`}
                  className={`inline-block text-white [text-rendering:geometricPrecision] drop-shadow-[0_10px_26px_rgba(0,0,0,0.42)] home-heading-word-reveal ${
                    isVisible ? "is-visible" : ""
                  }`}
                  style={{
                    "--home-word-delay": `${wordDelayMs}ms`,
                    "--home-word-duration": "0.78s",
                  }}
                >
                  {part}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}


function renderFeatureDetail() {
  return null;
}

function useCardScrollMotion(prefersReducedMotion, accent, index, useFlatLaptopMotion) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.94", "end 0.08"],
  });
  const direction = index % 2 === 0 ? -1 : 1;
  const springConfig = { stiffness: 150, damping: 30, mass: 0.42 };

  const cardY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], useFlatLaptopMotion ? [18, 0, -4] : [16, 0, -6]),
    springConfig
  );
  const cardX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * 10, 0, direction * -2] : [direction * 14, 0, direction * -4]
    ),
    springConfig
  );
  const cardOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.28, 0.55, 1], useFlatLaptopMotion ? [0.76, 0.94, 1, 1] : [0.88, 0.96, 1, 1]),
    springConfig
  );
  const glowOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.32, 0.7, 1],
      useFlatLaptopMotion ? [0.22, 0.42, 0.54, 0.28] : [0.36, 0.78, 0.9, 0.52]
    ),
    springConfig
  );
  const accentSweepOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.35, 0.75, 1],
      useFlatLaptopMotion ? [0.04, 0.08, 0.12, 0.06] : [0.07, 0.16, 0.22, 0.1]
    ),
    springConfig
  );
  const accentSweepX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * -6, 0, direction * 4] : [direction * -14, 0, direction * 10]
    ),
    springConfig
  );

  if (prefersReducedMotion) {
    return {
      ref,
      cardStyle: undefined,
      glowStyle: undefined,
      previewStyle: undefined,
      contentStyle: undefined,
      accentSweepStyle: undefined,
    };
  }

  return {
    ref,
    cardStyle: {
      x: cardX,
      y: cardY,
      opacity: cardOpacity,
      scale: 1,
    },
    glowStyle: { opacity: glowOpacity },
    previewStyle: undefined,
    contentStyle: undefined,
    accentSweepStyle: { opacity: accentSweepOpacity, x: accentSweepX },
  };
}

function useJourneySwipeMotion(prefersReducedMotion, index, useFlatLaptopMotion) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "end 0.08"],
  });
  const direction = index % 2 === 0 ? -1 : 1;
  const springConfig = { stiffness: 120, damping: 24, mass: 0.46 };

  const cardY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion ? [18, 8, 0, -3, -8] : [34, 18, 0, -10, -26]
    ),
    springConfig
  );
  const cardX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 10, direction * 4, 0, direction * -2, direction * -6]
        : [direction * 44, direction * 18, 0, direction * -12, direction * -34]
    ),
    springConfig
  );
  const cardRotate = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [0, 0, 0, 0, 0]
        : [direction * 5.5, direction * 2.5, 0, direction * -1.8, direction * -4]
    ),
    springConfig
  );
  const cardScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.22, 0.5, 0.82, 1],
      useFlatLaptopMotion ? [1, 1, 1, 1, 1] : [0.94, 0.975, 1, 0.985, 0.96]
    ),
    springConfig
  );
  const cardOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.18, 0.45, 0.8, 1],
      useFlatLaptopMotion ? [0.82, 0.92, 1, 0.96, 0.88] : [0.62, 0.82, 1, 0.94, 0.78]
    ),
    springConfig
  );
  const glowOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.35, 0.65, 1],
      useFlatLaptopMotion ? [0.22, 0.42, 0.54, 0.24] : [0.18, 0.48, 0.58, 0.2]
    ),
    springConfig
  );
  const accentSweepOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.28, 0.6, 1],
      useFlatLaptopMotion ? [0.03, 0.08, 0.1, 0.04] : [0.05, 0.16, 0.2, 0.04]
    ),
    springConfig
  );
  const accentSweepX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      useFlatLaptopMotion ? [direction * -6, 0, direction * 4] : [direction * -18, 0, direction * 14]
    ),
    springConfig
  );
  const previewX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 3, direction * 1, 0, direction * -1, direction * -2]
        : [direction * 16, direction * 7, 0, direction * -4, direction * -10]
    ),
    springConfig
  );
  const previewY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], useFlatLaptopMotion ? [2, 0, -1] : [8, 0, -4]),
    springConfig
  );
  const contentX = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.2, 0.5, 0.8, 1],
      useFlatLaptopMotion
        ? [direction * 2, direction * 1, 0, direction * -1, direction * -2]
        : [direction * 10, direction * 4, 0, direction * -3, direction * -8]
    ),
    springConfig
  );

  if (prefersReducedMotion) {
    return {
      ref,
      cardStyle: undefined,
      glowStyle: undefined,
      previewStyle: undefined,
      contentStyle: undefined,
      accentSweepStyle: undefined,
    };
  }

  return {
    ref,
    cardStyle: {
      x: cardX,
      y: cardY,
      rotateZ: cardRotate,
      scale: cardScale,
      opacity: cardOpacity,
    },
    glowStyle: { opacity: glowOpacity },
    previewStyle: { x: previewX, y: previewY },
    contentStyle: { x: contentX },
    accentSweepStyle: { opacity: accentSweepOpacity, x: accentSweepX },
  };
}

function DesktopRevealCard({ children, index = 0, className = "" }) {
  const { ref, isVisible } = useHomeDesktopReveal(true, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });

  return (
    <div
      ref={ref}
      className={`home-desktop-reveal home-desktop-reveal-card ${
        isVisible ? "is-visible" : ""
      } ${className}`}
      style={{ "--home-reveal-delay": `${Math.min(index, 11) * 110}ms` }}
    >
      {children}
    </div>
  );
}

function FeatureCardDesktop({ card, index }) {
  return (
    <DesktopRevealCard
      index={index}
      className={`group relative min-w-0 h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card home-updates-desktop-card ${
        card.previewType === "director" ? "md:col-span-2 xl:col-span-2" : ""
      } ${getFeatureCardWideSpan(card.previewType)} ${getFeatureCardWideOrder(card.previewType)}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-72`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-65" />
      <div className="relative z-10 flex h-full flex-col home-desktop-card-sequence">
        <div>{renderFeaturePreview(card, true)}</div>
        <div className="mt-5 flex-1 home-desktop-panel-sequence">
          <h3 className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]">
            {card.title}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7">
            {card.copy}
          </p>
          {renderFeatureDetail(card)}
        </div>
      </div>
    </DesktopRevealCard>
  );
}

function JourneyCardDesktop({ card, index }) {
  return (
    <DesktopRevealCard
      index={index}
      className={`group relative min-w-0 h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 xl:p-5 2xl:p-6 home-desktop-lite-card home-updates-desktop-card ${getJourneyCardWideSpan()}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-72`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-65" />
      <div className="relative z-10 flex h-full flex-col home-desktop-card-sequence">
        <div>{renderJourneyPreview(card, true)}</div>
        <div className="mt-5 flex-1 home-desktop-panel-sequence">
          <span className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/58">
            {getJourneyStepLabel(index)}
          </span>
          <h3 className="mt-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]">
            {card.title}
          </h3>
          <p className="mt-3 text-[15px] leading-7 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7">
            {card.copy}
          </p>
        </div>
      </div>
    </DesktopRevealCard>
  );
}

function FeatureCard({ card, index, prefersReducedMotion, useFlatLaptopMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } = useCardScrollMotion(
    prefersReducedMotion,
    card.accent,
    index,
    useFlatLaptopMotion
  );
  const mobileCopy = getCompactCardCopy(card.copy);

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : useFlatLaptopMotion
          ? {
              y: -4,
              scale: 1.006,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
            }
          : {
              y: -6,
              scale: 1.012,
              rotateX: -1.5,
              rotateY: index % 2 === 0 ? -2.2 : 2.2,
              transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
            }
      }
      style={cardStyle}
      className={`liquid-glass-soft group relative min-w-0 h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-6 ${
        card.previewType === "director" ? "md:col-span-2 xl:col-span-2" : ""
      } xl:p-5 2xl:p-6 ${getFeatureCardWideSpan(card.previewType)} ${getFeatureCardWideOrder(card.previewType)} will-change-transform [transform-style:preserve-3d]`}
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} hidden w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl sm:block`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-80" />
      <div className="relative z-10 flex h-full flex-col">
        <motion.div
          style={previewStyle}
          className="transform-gpu will-change-transform [backface-visibility:hidden] [transform-style:preserve-3d]"
        >
          {renderFeaturePreview(card)}
        </motion.div>
        <motion.div
          variants={previewStaggerVariants}
          style={contentStyle}
          className="mt-4 flex-1 will-change-transform sm:mt-5"
        >
          <motion.h3
            variants={previewTitleVariants}
            className="text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-2.5 text-[14px] leading-6 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:mt-3 sm:text-[15px] sm:leading-7 xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
          >
            {mobileCopy}
          </motion.p>
          {renderFeatureDetail(card)}
        </motion.div>
      </div>
    </motion.div>
  );
}

function JourneyCard({ card, index, prefersReducedMotion, useFlatLaptopMotion }) {
  const { ref, cardStyle, glowStyle, previewStyle, contentStyle, accentSweepStyle } =
    useJourneySwipeMotion(prefersReducedMotion, index, useFlatLaptopMotion);
  const mobileCopy = getCompactCardCopy(card.copy);

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : useFlatLaptopMotion
          ? {
              y: -4,
              scale: 1.006,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
            }
          : {
              y: -5,
              scale: 1.01,
              rotateZ: index % 2 === 0 ? -1.2 : 1.2,
              transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
            }
      }
      style={cardStyle}
      className={`liquid-glass-soft group relative min-w-0 h-full overflow-hidden rounded-[30px] border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(20,20,26,0.84),rgba(8,8,12,0.76))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] will-change-transform [transform-style:preserve-3d] sm:p-6 xl:p-5 2xl:p-6 ${getJourneyCardWideSpan()}`}
    >
      <motion.div
        style={glowStyle}
        className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r ${getAccentRail(
          card.accent
        )} opacity-90`}
      />
      <motion.div
        style={accentSweepStyle}
        className={`pointer-events-none absolute inset-y-6 ${index % 2 === 0 ? "-left-8" : "-right-8"} hidden w-28 rounded-full bg-gradient-to-b ${getAccentRail(
          card.accent
        )} blur-3xl sm:block`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] opacity-80" />
      <div className="relative z-10 flex h-full flex-col">
        <motion.div
          style={previewStyle}
          className="transform-gpu will-change-transform [backface-visibility:hidden] [transform-style:preserve-3d]"
        >
          {renderJourneyPreview(card)}
        </motion.div>
        <motion.div
          variants={previewStaggerVariants}
          style={contentStyle}
          className="mt-4 flex-1 will-change-transform sm:mt-5"
        >
          <motion.span
            variants={previewItemVariants}
            className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/58"
          >
            {getJourneyStepLabel(index)}
          </motion.span>
          <motion.h3
            variants={previewTitleVariants}
            className="mt-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_10px_22px_rgba(255,255,255,0.08)] sm:text-[1.6rem] xl:text-[1.32rem] 2xl:text-[1.45rem]"
          >
            {card.title}
          </motion.h3>
          <motion.p
            variants={previewItemVariants}
            className="mt-2.5 text-[14px] leading-6 text-white/86 drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] sm:mt-3 sm:text-[15px] sm:leading-7 xl:text-[13px] xl:leading-6 2xl:text-[15px] 2xl:leading-7"
          >
            {mobileCopy}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}


export {
  DesktopLiteHeadline,
  DesktopRevealCard,
  FeatureCard,
  FeatureCardDesktop,
  JourneyCard,
  JourneyCardDesktop,
};



