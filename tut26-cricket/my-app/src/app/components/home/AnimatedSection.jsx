"use client";

import { motion } from "framer-motion";

export default function AnimatedSection({
  children,
  className,
  id,
  viewportAmount = 0.12,
  viewportMargin = "0px 0px -10% 0px",
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 64 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}
