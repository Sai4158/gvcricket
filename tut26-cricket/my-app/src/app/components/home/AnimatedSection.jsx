"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedSection({
  children,
  className,
  id,
  direction = "up",
  distance = 52,
  delay = 0,
  viewportAmount = 0.08,
  viewportMargin = "0px 0px -6% 0px",
}) {
  const prefersReducedMotion = useReducedMotion();
  const hiddenMotion = prefersReducedMotion
    ? false
    : {
        opacity: 0,
        scale: 0.975,
        filter: "blur(10px)",
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
  const visibleMotion = prefersReducedMotion
    ? undefined
    : {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
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
        duration: prefersReducedMotion ? 0 : 0.84,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}
