"use client";


/**
 * File overview:
 * Purpose: UI component for Home screens and flows.
 * Main exports: AnimatedSection.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
import { motion, useReducedMotion } from "framer-motion";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "./useHomeDesktopReveal";

export default function AnimatedSection({
  children,
  className,
  id,
  direction = "up",
  distance = 36,
  delay = 0,
  viewportAmount = 0.02,
  viewportMargin = "0px 0px 12% 0px",
}) {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const { ref, isVisible } = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: 0.08,
    rootMargin: "0px 0px -6% 0px",
    resetOnExit: true,
  });
  const hiddenMotion = shouldReduceMotion
    ? false
    : {
        opacity: 0,
        scale: 0.992,
        filter: "blur(4px)",
        x:
          direction === "left"
            ? -Math.min(distance, 18)
            : direction === "right"
            ? Math.min(distance, 18)
            : 0,
        y:
          direction === "up"
            ? Math.min(distance, 18)
            : direction === "down"
            ? -Math.min(distance, 18)
            : 10,
      };
  const visibleMotion = shouldReduceMotion
    ? undefined
    : {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        x: 0,
        y: 0,
      };

  if (useDesktopLiteMotion) {
    return (
      <section
        id={id}
        ref={ref}
        className={`home-desktop-reveal home-desktop-reveal-section relative ${
          isVisible ? "is-visible" : ""
        } ${className}`}
      >
        <div className="relative z-10">{children}</div>
      </section>
    );
  }

  return (
    <motion.section
      id={id}
      initial={hiddenMotion}
      whileInView={visibleMotion}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{
        delay,
        duration: shouldReduceMotion ? 0 : 0.72,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`relative ${className}`}
    >
      {!shouldReduceMotion ? (
        <>
          <div
            aria-hidden="true"
            className="home-ambient-glow home-ambient-glow-primary pointer-events-none absolute inset-x-[8%] top-4 z-0 h-28 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09)_0%,rgba(168,85,247,0.08)_32%,rgba(14,165,233,0.06)_54%,transparent_76%)] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="home-ambient-glow home-ambient-glow-secondary pointer-events-none absolute bottom-0 left-[8%] z-0 h-24 w-40 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0.04)_44%,transparent_74%)] blur-3xl"
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}
