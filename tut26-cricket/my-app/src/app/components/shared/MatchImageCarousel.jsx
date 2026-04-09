"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: MatchImageCarousel.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SafeMatchImage from "./SafeMatchImage";

const HOLD_DELAY_MS = 520;
const SWIPE_THRESHOLD_PX = 42;

export default function MatchImageCarousel({
  images = [],
  alt = "Match image",
  compact = false,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
  showFallback = false,
  autoPlay = true,
  autoPlayDelayMs = 2000,
  autoPlayInitialDelayMs = 1000,
  transitionStyle = "fade",
  onActiveImageChange,
  onImageTap,
  onImageHold,
}) {
  const normalizedImages = useMemo(
    () =>
      Array.isArray(images)
        ? images.filter((image) => image?.url || image?.id)
        : [],
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState(1);
  const holdTimerRef = useRef(null);
  const interactionTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const holdTriggeredRef = useRef(false);

  const resolvedActiveIndex = normalizedImages.length
    ? Math.min(activeIndex, normalizedImages.length - 1)
    : 0;
  const activeImage = normalizedImages[resolvedActiveIndex] || null;
  const nextImage =
    normalizedImages.length > 1
      ? normalizedImages[(resolvedActiveIndex + 1) % normalizedImages.length]
      : null;

  const setCarouselIndex = useCallback((nextIndex, direction = 1) => {
    setTransitionDirection(direction);
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    onActiveImageChange?.(activeImage, resolvedActiveIndex);
  }, [activeImage, onActiveImageChange, resolvedActiveIndex]);

  useEffect(() => {
    if (!autoPlay || normalizedImages.length <= 1 || isInteracting) {
      return undefined;
    }

    const delay =
      resolvedActiveIndex === 0 ? autoPlayInitialDelayMs : autoPlayDelayMs;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => {
        const nextCurrent = normalizedImages.length
          ? Math.min(current, normalizedImages.length - 1)
          : 0;
        setTransitionDirection(1);
        return (nextCurrent + 1) % normalizedImages.length;
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    autoPlay,
    autoPlayDelayMs,
    autoPlayInitialDelayMs,
    isInteracting,
    normalizedImages.length,
    resolvedActiveIndex,
  ]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (interactionTimerRef.current) {
        window.clearTimeout(interactionTimerRef.current);
        interactionTimerRef.current = null;
      }
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (event) => {
    if (interactionTimerRef.current) {
      window.clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }
    setIsInteracting(true);
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    holdTriggeredRef.current = false;
    clearHoldTimer();
    if (activeImage && onImageHold) {
      holdTimerRef.current = window.setTimeout(() => {
        holdTriggeredRef.current = true;
        onImageHold(activeImage, resolvedActiveIndex, event);
      }, HOLD_DELAY_MS);
    }
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current) {
      return;
    }

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (deltaX > 10 || deltaY > 10) {
      clearHoldTimer();
    }
  };

  const handlePointerEnd = (event) => {
    const releaseInteraction = () => {
      holdTriggeredRef.current = false;
      interactionTimerRef.current = window.setTimeout(() => {
        setIsInteracting(false);
        interactionTimerRef.current = null;
      }, 320);
    };

    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    clearHoldTimer();

    if (!start) {
      releaseInteraction();
      return;
    }

    const deltaX = event.clientX - start.x;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && normalizedImages.length > 1) {
      const nextIndex =
        deltaX < 0
          ? (resolvedActiveIndex + 1) % normalizedImages.length
          : (resolvedActiveIndex - 1 + normalizedImages.length) %
            normalizedImages.length;
      setCarouselIndex(nextIndex, deltaX < 0 ? 1 : -1);
      releaseInteraction();
      return;
    }

    if (!holdTriggeredRef.current && activeImage) {
      onImageTap?.(activeImage, resolvedActiveIndex, event);
    }

    releaseInteraction();
  };

  if (!activeImage && !showFallback) {
    return null;
  }

  const animatedImageClassName =
    imageClassName || "object-cover object-center";
  const animatedFallbackClassName =
    fallbackClassName ||
    imageClassName ||
    "object-contain object-center bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))] p-8";

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? "12%" : "-12%",
      opacity: 0.55,
      scale: 0.985,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction) => ({
      x: direction > 0 ? "-12%" : "12%",
      opacity: 0.55,
      scale: 0.985,
    }),
  };

  return (
    <div className={className}>
      <div
        className={`relative overflow-hidden rounded-[20px] border border-white/8 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
          compact ? "aspect-[16/8.8]" : "aspect-[16/9]"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
      >
        <AnimatePresence initial={false} custom={transitionDirection} mode="popLayout">
          <motion.div
            key={activeImage?.id || activeImage?.url || "fallback"}
            className="absolute inset-0"
            custom={transitionDirection}
            initial={transitionStyle === "slide" ? "enter" : { opacity: 0 }}
            animate={transitionStyle === "slide" ? "center" : { opacity: 1 }}
            exit={transitionStyle === "slide" ? "exit" : { opacity: 0 }}
            variants={transitionStyle === "slide" ? slideVariants : undefined}
            transition={
              transitionStyle === "slide"
                ? { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.24, ease: "easeOut" }
            }
          >
            <SafeMatchImage
              src={activeImage?.url || ""}
              alt={alt}
              fill
              sizes={compact ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 100vw, 1200px"}
              className={animatedImageClassName}
              fallbackClassName={animatedFallbackClassName}
              draggable={false}
              loading={compact ? "lazy" : "eager"}
            />
          </motion.div>
        </AnimatePresence>
        {nextImage ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
            <SafeMatchImage
              src={nextImage.url || ""}
              alt=""
              width={16}
              height={9}
              className="h-auto w-auto"
              loading="eager"
            />
          </div>
        ) : null}
        {normalizedImages.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5">
            {normalizedImages.map((image, index) => (
              <span
                key={image.id || `dot-${index}`}
                className={`h-1.5 rounded-full transition-all ${
                  index === resolvedActiveIndex
                    ? "w-5 bg-white/90"
                    : "w-1.5 bg-white/35"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}


