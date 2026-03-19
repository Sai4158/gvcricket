"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function LiquidSportText({
  as: Component = "h2",
  text,
  className = "",
  lineClassName = "",
  variant = "default",
  cursor = false,
  typing = false,
  characterTyping = false,
  characterStagger = 0.028,
  characterLineDelay = 0.18,
  characterDuration = 0.42,
  delay = 0,
  once = true,
  viewportAmount = 0.45,
  viewportMargin = "0px 0px -10% 0px",
}) {
  const prefersReducedMotion = useReducedMotion();
  const lines = Array.isArray(text) ? text : [text];
  const isDarkOutline = variant === "dark-outline";
  const isHeroBright = variant === "hero-bright";

  return (
    <Component className={className}>
      {lines.map((line, index) => {
        const lineDelay = delay + index * 0.14;
        const baseLineClass = isDarkOutline
          ? `relative z-10 block text-[#050505] [text-rendering:geometricPrecision] [paint-order:stroke_fill] [WebkitTextStroke:1.7px_rgba(255,255,255,0.54)] drop-shadow-[0_8px_22px_rgba(0,0,0,0.42)] [text-shadow:0_0_24px_rgba(196,181,253,0.16),0_2px_0_rgba(255,255,255,0.2)] ${lineClassName}`
          : isHeroBright
          ? `relative z-10 block text-white [text-rendering:geometricPrecision] drop-shadow-[0_20px_44px_rgba(0,0,0,0.46)] [text-shadow:0_2px_0_rgba(0,0,0,0.22),0_0_22px_rgba(255,255,255,0.22),0_0_42px_rgba(191,219,254,0.12)] ${lineClassName}`
          : `relative z-10 block text-white [text-rendering:geometricPrecision] drop-shadow-[0_10px_26px_rgba(0,0,0,0.48)] [text-shadow:0_2px_0_rgba(0,0,0,0.34),0_0_22px_rgba(255,255,255,0.1)] ${lineClassName}`;
        const revealOverlayClass = isDarkOutline
          ? `pointer-events-none absolute inset-0 z-20 block bg-[linear-gradient(108deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.1)_22%,rgba(244,114,182,0.18)_40%,rgba(196,181,253,0.2)_52%,rgba(255,255,255,0.08)_64%,rgba(255,255,255,0)_84%)] bg-clip-text text-transparent ${lineClassName}`
          : isHeroBright
          ? `pointer-events-none absolute inset-0 z-20 block bg-[linear-gradient(108deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.1)_18%,rgba(255,255,255,0.34)_32%,rgba(253,224,71,0.18)_44%,rgba(191,219,254,0.24)_56%,rgba(255,255,255,0.1)_68%,rgba(255,255,255,0)_84%)] bg-clip-text text-transparent ${lineClassName}`
          : `pointer-events-none absolute inset-0 z-20 block bg-[linear-gradient(112deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.08)_24%,rgba(255,246,196,0.28)_40%,rgba(125,211,252,0.16)_54%,rgba(255,255,255,0.08)_64%,rgba(255,255,255,0)_84%)] bg-clip-text text-transparent ${lineClassName}`;
        const shimmerClass = isDarkOutline
          ? `pointer-events-none absolute inset-0 z-30 block bg-[linear-gradient(108deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.1)_22%,rgba(255,255,255,0.24)_32%,rgba(192,132,252,0.42)_46%,rgba(255,255,255,0.16)_56%,rgba(255,255,255,0)_74%)] bg-[length:220%_100%] bg-clip-text text-transparent mix-blend-screen ${lineClassName}`
          : isHeroBright
          ? `pointer-events-none absolute inset-0 z-30 block bg-[linear-gradient(108deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.14)_22%,rgba(255,255,255,0.46)_34%,rgba(253,224,71,0.24)_46%,rgba(191,219,254,0.28)_58%,rgba(255,255,255,0.12)_70%,rgba(255,255,255,0)_84%)] bg-[length:255%_100%] bg-clip-text text-transparent mix-blend-screen ${lineClassName}`
          : `pointer-events-none absolute inset-0 z-30 block bg-[linear-gradient(112deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.16)_26%,rgba(255,246,196,0.36)_40%,rgba(167,139,250,0.28)_54%,rgba(255,255,255,0.12)_66%,rgba(255,255,255,0)_82%)] bg-[length:220%_100%] bg-clip-text text-transparent mix-blend-screen ${lineClassName}`;
        const offsetShadowClass = isDarkOutline
          ? `pointer-events-none absolute inset-0 z-0 block translate-x-[2px] translate-y-[2px] text-fuchsia-300/28 ${lineClassName}`
          : isHeroBright
          ? `pointer-events-none absolute inset-0 z-0 block translate-x-[1px] translate-y-[1px] text-sky-100/10 ${lineClassName}`
          : `pointer-events-none absolute inset-0 z-0 block translate-x-[3px] translate-y-[3px] ${typing ? "text-neutral-950/42" : "text-neutral-950/26"} ${lineClassName}`;
        const shouldCharacterType = characterTyping && !prefersReducedMotion;

        if (shouldCharacterType) {
          return (
            <motion.span
              key={`${line}-${index}`}
              className="relative block overflow-visible"
              animate={
                isHeroBright
                  ? {
                      y: [0, -2, 0],
                      scale: [1, 1.004, 1],
                    }
                  : {
                      y: [0, -1.2, 0],
                    }
              }
              transition={
                isHeroBright
                  ? {
                      duration: 5.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.18,
                    }
                  : {
                      duration: 6.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.14,
                    }
              }
            >
              <span
                aria-hidden="true"
                className={offsetShadowClass}
              >
                {line}
              </span>
              <motion.span
                initial="hidden"
                whileInView="visible"
                viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      delayChildren: delay + index * characterLineDelay,
                      staggerChildren: characterStagger,
                    },
                  },
                }}
                className={`${baseLineClass} whitespace-pre`}
              >
                {Array.from(line).map((char, charIndex) => (
                  <motion.span
                    key={`${line}-${index}-${charIndex}`}
                    variants={{
                      hidden: {
                        opacity: 0,
                        y: 18,
                        filter: "blur(8px)",
                      },
                      visible: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: {
                          duration: characterDuration,
                          ease: [0.22, 1, 0.36, 1],
                        },
                      },
                    }}
                    className="inline-block"
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.span>
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: isHeroBright ? 0.34 : 0.24 }}
                viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
                transition={{
                  duration: 0.82,
                  delay: delay + index * characterLineDelay + line.length * characterStagger * 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={revealOverlayClass}
              >
                {line}
              </motion.span>
              <motion.span
                aria-hidden="true"
                className={shimmerClass}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: isHeroBright ? 0.2 : 0.12 }}
                viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
                animate={{
                  backgroundPosition: ["120% 50%", "-20% 50%"],
                  opacity: isHeroBright ? [0.18, 0.32, 0.2] : [0.1, 0.18, 0.12],
                }}
                transition={{
                  backgroundPosition: {
                    duration: isHeroBright ? 3.2 : 4.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: delay + index * characterLineDelay + 0.45,
                  },
                  opacity: {
                    duration: 3.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: delay + index * characterLineDelay + 0.45,
                  },
                }}
              >
                {line}
              </motion.span>
            </motion.span>
          );
        }

        return (
          <motion.span
            key={`${line}-${index}`}
            className="relative block overflow-visible"
            animate={
              prefersReducedMotion || !isHeroBright
                ? undefined
                : {
                    y: [0, -2, 0],
                    scale: [1, 1.004, 1],
                  }
            }
            transition={
              prefersReducedMotion || !isHeroBright
                ? undefined
                : {
                    duration: 5.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.18,
                  }
            }
          >
            <motion.span
              initial={
                prefersReducedMotion
                  ? false
                  : typing
                  ? { clipPath: "inset(0 100% 0 0)", opacity: 0.78 }
                  : { opacity: 1 }
              }
              whileInView={
                prefersReducedMotion
                  ? undefined
                  : typing
                  ? { clipPath: "inset(0 0% 0 0)", opacity: 1 }
                  : undefined
              }
              viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
              transition={{
                duration: prefersReducedMotion ? 0 : typing ? 0.92 : 0,
                delay: prefersReducedMotion ? 0 : lineDelay,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={baseLineClass}
            >
              {line}
            </motion.span>

            <motion.span
              aria-hidden="true"
              initial={
                prefersReducedMotion
                  ? false
                  : typing
                  ? { clipPath: "inset(0 100% 0 0)", opacity: 0.08 }
                  : { clipPath: "inset(0 100% 0 0)", opacity: 0.12 }
              }
              whileInView={
                prefersReducedMotion
                  ? undefined
                  : { clipPath: "inset(0 0% 0 0)", opacity: 0.52 }
              }
              viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.84,
                delay: prefersReducedMotion ? 0 : lineDelay,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={revealOverlayClass}
            >
              {line}
            </motion.span>

            <motion.span
              aria-hidden="true"
              className={shimmerClass}
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      backgroundPosition: ["120% 50%", "-20% 50%"],
                      opacity: isDarkOutline
                        ? [0.2, 0.48, 0.24]
                        : isHeroBright
                        ? [0.14, 0.3, 0.18]
                        : [0.18, 0.42, 0.24],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: isHeroBright ? 3.4 : 3.1,
                      repeat: Infinity,
                      repeatDelay: isHeroBright ? 0.4 : 0.45,
                      ease: "easeInOut",
                      delay: lineDelay + 0.34,
                    }
              }
            >
              {line}
            </motion.span>

            <span
              aria-hidden="true"
              className={offsetShadowClass}
            >
              {line}
            </span>

            {cursor ? (
              <motion.span
                aria-hidden="true"
                initial={prefersReducedMotion ? false : { left: "0%", opacity: 0 }}
                whileInView={
                  prefersReducedMotion
                    ? undefined
                    : {
                        left: "100%",
                        opacity: [0, 1, 1, 0],
                      }
                }
                viewport={{ once, amount: viewportAmount, margin: viewportMargin }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.9,
                  delay: prefersReducedMotion ? 0 : lineDelay,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`pointer-events-none absolute top-[10%] z-30 h-[78%] w-[2px] -translate-x-1/2 rounded-full ${
                  isHeroBright
                    ? "bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(191,219,254,0.96))] shadow-[0_0_24px_rgba(255,255,255,0.7),0_0_34px_rgba(125,211,252,0.32)]"
                    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(253,224,71,0.95))] shadow-[0_0_22px_rgba(255,255,255,0.55),0_0_28px_rgba(250,204,21,0.35)]"
                }`}
              />
            ) : null}
          </motion.span>
        );
      })}
    </Component>
  );
}
