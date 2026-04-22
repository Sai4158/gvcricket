"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: RollingDigitText.
 * Major callers: Match scoreboard and setup counters.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const ROLLING_DIGIT_DURATION_S = 0.82;
const ROLLING_DIGIT_DURATION_MS = Math.round(ROLLING_DIGIT_DURATION_S * 1000);

function isNumericCharacter(character) {
  return /^[0-9]$/.test(String(character || ""));
}

function getRollingSlotWidthClass(
  character,
  previousCharacter,
  digitWidthClass,
  dotWidthClass,
) {
  if (isNumericCharacter(character) || isNumericCharacter(previousCharacter)) {
    return digitWidthClass;
  }

  if (character === "." || previousCharacter === ".") {
    return dotWidthClass;
  }

  return "w-auto";
}

function getRollingDirection(previousCharacter, nextCharacter, fallbackDirection) {
  if (
    isNumericCharacter(previousCharacter) &&
    isNumericCharacter(nextCharacter)
  ) {
    const previousDigit = Number(previousCharacter);
    const nextDigit = Number(nextCharacter);

    if (nextDigit === previousDigit) {
      return 0;
    }

    return nextDigit > previousDigit ? 1 : -1;
  }

  return fallbackDirection;
}

export default function RollingDigitText({
  text = "",
  valueNumber = 0,
  className = "",
  trackingClass = "tracking-[-0.03em]",
  digitWidthClass = "w-[0.46em]",
  dotWidthClass = "w-[0.16em]",
}) {
  const nextText = String(text || "");
  const [transitionState, setTransitionState] = useState(() => ({
    previousText: nextText,
    previousValue: valueNumber,
    currentText: nextText,
    currentValue: valueNumber,
    animationKey: 0,
    isTransitioning: false,
  }));
  const direction =
    transitionState.currentValue === transitionState.previousValue
      ? 1
      : transitionState.currentValue > transitionState.previousValue
        ? 1
        : -1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransitionState((current) => {
      if (
        current.currentText === nextText &&
        current.currentValue === valueNumber
      ) {
        return current;
      }

      return {
        previousText: current.currentText,
        previousValue: current.currentValue,
        currentText: nextText,
        currentValue: valueNumber,
        animationKey: current.animationKey + 1,
        isTransitioning: true,
      };
    });
  }, [nextText, valueNumber]);

  useEffect(() => {
    if (!transitionState.isTransitioning) {
      return undefined;
    }

    const settleTimer = window.setTimeout(() => {
      setTransitionState((current) => {
        if (!current.isTransitioning) {
          return current;
        }

        return {
          ...current,
          previousText: current.currentText,
          previousValue: current.currentValue,
          isTransitioning: false,
        };
      });
    }, ROLLING_DIGIT_DURATION_MS);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [transitionState.isTransitioning]);

  const currentCharacters = Array.from(transitionState.currentText);
  const previousCharacters = Array.from(transitionState.previousText);

  return (
    <span
      className={`inline-flex items-baseline justify-center leading-none ${trackingClass} ${className}`}
    >
      {currentCharacters.map((character, index) => {
        const previousIndex =
          previousCharacters.length - (currentCharacters.length - index);
        const previousCharacter =
          previousIndex >= 0 ? previousCharacters[previousIndex] : "";
        const slotWidthClass = getRollingSlotWidthClass(
          character,
          previousCharacter,
          digitWidthClass,
          dotWidthClass,
        );
        const slotDirection = getRollingDirection(
          previousCharacter,
          character,
          direction,
        );
        const shouldAnimate =
          transitionState.isTransitioning && previousCharacter !== character;
        const placeholderCharacter = character || previousCharacter || "0";

        if (!shouldAnimate) {
          return (
            <span
              key={`slot:${index}:${character}`}
              className={`relative inline-flex h-[1em] items-center justify-center overflow-hidden align-baseline ${slotWidthClass}`}
            >
              <span className="pointer-events-none select-none opacity-0">
                {placeholderCharacter}
              </span>
              <span className="absolute inset-0 inline-flex h-[1em] items-center justify-center">
                {character}
              </span>
            </span>
          );
        }

        return (
          <span
            key={`slot:${transitionState.animationKey}:${index}`}
            className={`relative inline-flex h-[1em] items-center justify-center overflow-hidden align-baseline ${slotWidthClass}`}
          >
            <span className="pointer-events-none select-none opacity-0">
              {placeholderCharacter}
            </span>
            <motion.span
              key={`previous:${transitionState.animationKey}:${index}`}
              initial={{ opacity: 1, y: "0%" }}
              animate={{
                opacity: 0,
                y: slotDirection >= 0 ? "-112%" : "112%",
              }}
              transition={{
                duration: ROLLING_DIGIT_DURATION_S,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 inline-flex h-[1em] items-center justify-center"
              style={{ willChange: "transform" }}
            >
              {previousCharacter}
            </motion.span>
            <motion.span
              key={`current:${transitionState.animationKey}:${index}`}
              initial={{
                opacity: 0,
                y: slotDirection >= 0 ? "112%" : "-112%",
              }}
              animate={{ opacity: 1, y: "0%" }}
              transition={{
                duration: ROLLING_DIGIT_DURATION_S,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 inline-flex h-[1em] items-center justify-center"
              style={{ willChange: "transform" }}
            >
              {character}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}
