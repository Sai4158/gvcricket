"use client";

import { motion, useReducedMotion } from "framer-motion";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";
import useHomeDesktopReveal from "./useHomeDesktopReveal";

export default function HomeScrollFade({
  children,
  className = "",
  delayMs = 0,
  distance = 12,
  viewportAmount = 0.08,
  viewportMargin = "0px 0px -6% 0px",
}) {
  const prefersReducedMotion = useReducedMotion();
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const shouldReduceMotion = prefersReducedMotion || useDesktopLiteMotion;
  const { ref, isVisible } = useHomeDesktopReveal(useDesktopLiteMotion, {
    threshold: viewportAmount,
    rootMargin: viewportMargin,
    revealDelayMs: Math.max(0, delayMs),
  });

  return (
    <motion.div
      ref={useDesktopLiteMotion ? ref : undefined}
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, y: distance, filter: "blur(3px)" }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.68,
        delay: shouldReduceMotion ? 0 : delayMs / 1000,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`${className} ${
        useDesktopLiteMotion
          ? `home-desktop-reveal home-desktop-reveal-sm ${isVisible ? "is-visible" : ""}`
          : ""
      }`}
      style={
        useDesktopLiteMotion
          ? { "--home-reveal-delay": `${delayMs}ms` }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
