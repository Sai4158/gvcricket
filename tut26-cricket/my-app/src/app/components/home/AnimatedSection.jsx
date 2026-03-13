"use client";

import { motion } from "framer-motion";

export default function AnimatedSection({
  children,
  className,
  id,
  viewportAmount = 0.06,
  viewportMargin = "0px 0px -18% 0px",
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}
