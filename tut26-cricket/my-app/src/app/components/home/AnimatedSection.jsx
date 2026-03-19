"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

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
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 88%", "end 12%"],
  });
  const hiddenMotion = prefersReducedMotion
    ? false
    : {
        opacity: 0,
        scale: 0.992,
        filter: "blur(6px)",
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
  const sectionY = useSpring(
    useTransform(scrollYProgress, [0, 0.5, 1], [28, 0, -22]),
    { stiffness: 170, damping: 28, mass: 0.4 }
  );
  const sectionScale = useSpring(
    useTransform(scrollYProgress, [0, 0.45, 1], [0.985, 1, 0.992]),
    { stiffness: 170, damping: 28, mass: 0.4 }
  );
  const auraOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.2, 0.5, 1], [0.12, 0.24, 0.3, 0.14]),
    { stiffness: 190, damping: 30, mass: 0.35 }
  );
  const auraX = useSpring(useTransform(scrollYProgress, [0, 1], [-36, 34]), {
    stiffness: 170,
    damping: 30,
    mass: 0.4,
  });

  return (
    <motion.section
      ref={sectionRef}
      id={id}
      initial={hiddenMotion}
      whileInView={visibleMotion}
      viewport={{ once: true, amount: viewportAmount, margin: viewportMargin }}
      transition={{
        delay,
        duration: prefersReducedMotion ? 0 : 0.66,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={
        prefersReducedMotion
          ? undefined
          : {
              y: sectionY,
              scale: sectionScale,
            }
      }
      className={`relative ${className}`}
    >
      {!prefersReducedMotion ? (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[8%] top-4 z-0 h-28 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09)_0%,rgba(168,85,247,0.08)_32%,rgba(14,165,233,0.06)_54%,transparent_76%)] blur-3xl"
            style={{ opacity: auraOpacity, x: auraX }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-[8%] z-0 h-24 w-40 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0.04)_44%,transparent_74%)] blur-3xl"
            style={{ opacity: auraOpacity, x: auraX }}
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}
