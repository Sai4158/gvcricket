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
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
  const [loadedImageKeys, setLoadedImageKeys] = useState(() => new Set());
  const holdTimerRef = useRef(null);
  const interactionTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const holdTriggeredRef = useRef(false);

  const resolvedActiveIndex = normalizedImages.length
    ? Math.min(activeIndex, normalizedImages.length - 1)
    : 0;
  const activeImage = normalizedImages[resolvedActiveIndex] || null;
  const activeImageKey = activeImage?.id || activeImage?.url || "";
  const isImageReady = Boolean(activeImageKey) && loadedImageKeys.has(activeImageKey);
  const nextImage =
    normalizedImages.length > 1
      ? normalizedImages[(resolvedActiveIndex + 1) % normalizedImages.length]
      : null;
  const previousImage =
    normalizedImages.length > 1
      ? normalizedImages[
          (resolvedActiveIndex - 1 + normalizedImages.length) % normalizedImages.length
        ]
      : null;
  const previousImageKey = previousImage?.id || previousImage?.url || "";
  const nextImageKey = nextImage?.id || nextImage?.url || "";

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

  const handleArrowClick = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();

    if (normalizedImages.length <= 1) {
      return;
    }

    const nextIndex =
      direction > 0
        ? (resolvedActiveIndex + 1) % normalizedImages.length
        : (resolvedActiveIndex - 1 + normalizedImages.length) % normalizedImages.length;
    setCarouselIndex(nextIndex, direction);
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
      x: direction > 0 ? "7%" : "-7%",
      opacity: 0.78,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction > 0 ? "-7%" : "7%",
      opacity: 0.78,
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
        <AnimatePresence initial={false} custom={transitionDirection} mode="sync">
          <motion.div
            key={activeImage?.id || activeImage?.url || "fallback"}
            className="absolute inset-0"
            style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
            custom={transitionDirection}
            initial={
              transitionStyle === "slide"
                ? "enter"
                : { opacity: 0.01 }
            }
            animate={
              transitionStyle === "slide"
                ? "center"
                : { opacity: 1 }
            }
            exit={
              transitionStyle === "slide"
                ? "exit"
                : { opacity: 0.01 }
            }
            variants={transitionStyle === "slide" ? slideVariants : undefined}
            transition={
              transitionStyle === "slide"
                ? { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
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
              decoding="async"
              onLoad={() => {
                if (!activeImageKey) {
                  return;
                }
                setLoadedImageKeys((current) => {
                  if (current.has(activeImageKey)) {
                    return current;
                  }
                  const next = new Set(current);
                  next.add(activeImageKey);
                  return next;
                });
              }}
            />
          </motion.div>
        </AnimatePresence>
        <motion.div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(12,12,16,0.5),rgba(8,8,12,0.24))]"
          initial={false}
          animate={{ opacity: isImageReady ? 0 : 1 }}
          transition={{ duration: isImageReady ? 0.24 : 0.12, ease: "easeOut" }}
        >
          {!isImageReady ? (
            <div className="absolute inset-0 pending-shimmer bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
          ) : null}
        </motion.div>
        {!compact && (nextImage || previousImage) ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0">
            {activeImage ? (
              <SafeMatchImage
                src={activeImage.url || ""}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                className={animatedImageClassName}
                fallbackClassName={animatedFallbackClassName}
                loading="eager"
                decoding="async"
              />
            ) : null}
            {nextImage ? (
              <SafeMatchImage
                src={nextImage.url || ""}
                alt=""
                fill
                sizes={compact ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 100vw, 1200px"}
                className={animatedImageClassName}
                fallbackClassName={animatedFallbackClassName}
                loading="eager"
                decoding="async"
                onLoad={() => {
                  if (!nextImageKey) {
                    return;
                  }
                  setLoadedImageKeys((current) => {
                    if (current.has(nextImageKey)) {
                      return current;
                    }
                    const next = new Set(current);
                    next.add(nextImageKey);
                    return next;
                  });
                }}
              />
            ) : null}
            {previousImage ? (
              <SafeMatchImage
                src={previousImage.url || ""}
                alt=""
                fill
                sizes={compact ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 100vw, 1200px"}
                className={animatedImageClassName}
                fallbackClassName={animatedFallbackClassName}
                loading="eager"
                decoding="async"
                onLoad={() => {
                  if (!previousImageKey) {
                    return;
                  }
                  setLoadedImageKeys((current) => {
                    if (current.has(previousImageKey)) {
                      return current;
                    }
                    const next = new Set(current);
                    next.add(previousImageKey);
                    return next;
                  });
                }}
              />
            ) : null}
          </div>
        ) : null}
        {normalizedImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => handleArrowClick(event, -1)}
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-black/55 text-white shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition hover:bg-black/70"
              aria-label="Previous image"
            >
              <FaChevronLeft className="text-sm" />
            </button>
            <button
              type="button"
              onClick={(event) => handleArrowClick(event, 1)}
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-black/55 text-white shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition hover:bg-black/70"
              aria-label="Next image"
            >
              <FaChevronRight className="text-sm" />
            </button>
          </>
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


