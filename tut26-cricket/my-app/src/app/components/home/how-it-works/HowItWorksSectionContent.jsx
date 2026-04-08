"use client";

/**
 * File overview:
 * Purpose: UI component for Home screens and flows.
 * Main exports: HowItWorksSection.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */

import { motion, useReducedMotion } from "framer-motion";
import AnimatedSection from "../AnimatedSection";
import LiquidSportText from "../LiquidSportText";
import useHomeDesktopLiteMotion from "../useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "../useHomeDesktopReveal";
import { featureCards, journeyCards } from "./how-it-works-data";
import { gridVariants } from "./how-it-works-motion";
import {
  DesktopLiteHeadline,
  FeatureCard,
  FeatureCardDesktop,
  JourneyCard,
  JourneyCardDesktop,
} from "./card-shells";

export default function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion;
  const useFlatLaptopMotion = true;
  const featurePanelReveal = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const journeyPanelReveal = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.06,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const FeaturePanelTag = useDesktopLiteMotion ? "div" : motion.div;
  const JourneyPanelTag = useDesktopLiteMotion ? "div" : motion.div;
  const FeatureGridTag = useDesktopLiteMotion ? "div" : motion.div;
  const JourneyGridTag = useDesktopLiteMotion ? "div" : motion.div;
  const featurePanelProps = useDesktopLiteMotion
    ? {
        ref: featurePanelReveal.ref,
      }
    : {
        initial: { opacity: 0, x: -26, y: 16, scale: 0.992 },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
      };
  const journeyPanelProps = useDesktopLiteMotion
    ? {
        ref: journeyPanelReveal.ref,
      }
    : {
        initial: { opacity: 0, x: 26, y: 16, scale: 0.992 },
        whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1], delay: 0.03 },
      };
  const featureGridProps = useDesktopLiteMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        variants: gridVariants,
      };
  const journeyGridProps = useDesktopLiteMotion
    ? {}
    : {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, amount: 0.02, margin: "0px 0px 14% 0px" },
        variants: gridVariants,
      };

  return (
    <AnimatedSection
      id="updates"
      direction="left"
      className="mx-auto w-full max-w-7xl scroll-mt-28 overflow-hidden xl:max-w-[88rem] 2xl:max-w-[108rem]"
    >
      <div className="space-y-8">
        <FeaturePanelTag
          {...featurePanelProps}
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel home-updates-desktop-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
            useDesktopLiteMotion
              ? `home-desktop-reveal home-desktop-reveal-panel ${
                  featurePanelReveal.isVisible ? "is-visible" : ""
                }`
              : ""
          }`}
        >
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-amber-200/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(120,53,15,0.16))] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_rgba(245,158,11,0.18)]">
              New Update
            </span>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.34em] text-white/48">
              GV Cricket 2.0
            </p>
            <div className="mt-3">
              {useDesktopLiteMotion ? (
                <DesktopLiteHeadline
                  text={["New tools for", "live scoring"]}
                  isVisible={featurePanelReveal.isVisible}
                  delay={0.03}
                  className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                  lineClassName="leading-[0.98]"
                />
              ) : (
                <LiquidSportText
                  text={["New tools for", "live scoring"]}
                  characterTyping
                  characterStagger={0.02}
                  characterLineDelay={0.12}
                  characterDuration={0.34}
                  simplifyMotion={shouldReduceMotion}
                  lightweightCharacterReveal={useDesktopLiteMotion}
                  delay={0.03}
                  className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                  lineClassName="leading-[0.98]"
                />
              )}
            </div>
          </div>

          <FeatureGridTag
            {...featureGridProps}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-4 2xl:grid-cols-12 2xl:gap-5"
          >
            {featureCards.map((card, index) => (
              useDesktopLiteMotion ? (
                <FeatureCardDesktop key={card.title} card={card} index={index} />
              ) : (
                <FeatureCard
                  key={card.title}
                  card={card}
                  index={index}
                  prefersReducedMotion={shouldReduceMotion}
                  useFlatLaptopMotion={useFlatLaptopMotion}
                />
              )
            ))}
          </FeatureGridTag>
        </FeaturePanelTag>

        <JourneyPanelTag
          {...journeyPanelProps}
          className={`${useDesktopLiteMotion ? "home-desktop-lite-panel home-updates-desktop-panel" : "liquid-glass-soft"} rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(8,8,14,0.62))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-10 xl:p-8 2xl:p-10 ${
            useDesktopLiteMotion
              ? `home-desktop-reveal home-desktop-reveal-panel ${
                  journeyPanelReveal.isVisible ? "is-visible" : ""
                }`
              : ""
          }`}
        >
          <div className="mx-auto max-w-3xl text-center">
            {useDesktopLiteMotion ? (
              <DesktopLiteHeadline
                text={["What is", "GV Cricket?"]}
                isVisible={journeyPanelReveal.isVisible}
                delay={0.03}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            ) : (
              <LiquidSportText
                text={["What is", "GV Cricket?"]}
                characterTyping
                characterStagger={0.02}
                characterLineDelay={0.12}
                characterDuration={0.34}
                simplifyMotion={shouldReduceMotion}
                lightweightCharacterReveal={useDesktopLiteMotion}
                delay={0.03}
                className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                lineClassName="leading-[0.98]"
              />
            )}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/72 md:hidden">
              GV Cricket lets one person score live while everyone else can watch, hear updates, and follow the match in real time.
            </p>
            <p className="mx-auto mt-4 hidden max-w-xl text-sm leading-6 text-white/72 md:block md:text-base">
              GV Cricket is a mobile-first live scoring app for local cricket matches. One person updates the game, everyone else can watch it live, and the app can speak updates, play audio, and keep the match organized from start to finish.
            </p>
          </div>

          <JourneyGridTag
            {...journeyGridProps}
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-4 2xl:grid-cols-12 2xl:gap-5"
          >
            {journeyCards.map((card, index) => (
              useDesktopLiteMotion ? (
                <JourneyCardDesktop key={card.title} card={card} index={index} />
              ) : (
                <JourneyCard
                  key={card.title}
                  card={card}
                  index={index}
                  prefersReducedMotion={shouldReduceMotion}
                  useFlatLaptopMotion={useFlatLaptopMotion}
                />
              )
            ))}
          </JourneyGridTag>
        </JourneyPanelTag>
      </div>
    </AnimatedSection>
  );
}
