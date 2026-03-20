"use client";

import { motion, useReducedMotion } from "framer-motion";
import useAppleMobileSafari from "../../lib/useAppleMobileSafari";

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
  const isAppleMobileSafari = useAppleMobileSafari();
  const shouldReduceMotion = prefersReducedMotion || isAppleMobileSafari;
  const hiddenMotion = shouldReduceMotion
    ? false
    : {
        opacity: 0,
        scale: 0.994,
        x:
          direction === "left"
            ? -distance
            : direction === "right"
            ? distance
            : 0,
        y:
          direction === "up"
            ? distance
            : direction === "down"
            ? -distance
            : 0,
      };
  const visibleMotion = shouldReduceMotion
    ? undefined
    : {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
      };

  return (
    <motion.section
      id={id}
      initial={hiddenMotion}
      whileInView={visibleMotion}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{
        delay,
        duration: shouldReduceMotion ? 0 : 0.66,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`relative ${className}`}
    >
      {!shouldReduceMotion ? (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[8%] top-4 z-0 h-28 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09)_0%,rgba(168,85,247,0.08)_32%,rgba(14,165,233,0.06)_54%,transparent_76%)] blur-3xl"
            animate={{ opacity: [0.12, 0.2, 0.14] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-[8%] z-0 h-24 w-40 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0.04)_44%,transparent_74%)] blur-3xl"
            animate={{ opacity: [0.08, 0.14, 0.1] }}
            transition={{ duration: 8.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}
