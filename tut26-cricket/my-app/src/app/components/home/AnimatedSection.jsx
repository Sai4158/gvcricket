"use client";

import { motion } from "framer-motion";

export default function AnimatedSection({ children, className, id }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 64 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}
