"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedSection({
  children,
  className,
  id,
  viewportAmount = 0.08,
  viewportMargin = "0px 0px -6% 0px",
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.965 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.72,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}
