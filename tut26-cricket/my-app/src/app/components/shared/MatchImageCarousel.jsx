"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    onActiveImageChange?.(activeImage, resolvedActiveIndex);
  }, [activeImage, onActiveImageChange, resolvedActiveIndex]);

  useEffect(() => {
    if (!autoPlay || normalizedImages.length <= 1 || isInteracting) {
      return undefined;
    }

    const delay = resolvedActiveIndex === 0 ? 1000 : 2000;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => {
        const nextCurrent = normalizedImages.length
          ? Math.min(current, normalizedImages.length - 1)
          : 0;
        return (nextCurrent + 1) % normalizedImages.length;
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoPlay, isInteracting, normalizedImages.length, resolvedActiveIndex]);

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
      setActiveIndex((current) => {
        if (deltaX < 0) {
          return (current + 1) % normalizedImages.length;
        }
        return (current - 1 + normalizedImages.length) % normalizedImages.length;
      });
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
        <div className="absolute inset-0">
          <SafeMatchImage
            key={activeImage?.id || "fallback"}
            src={activeImage?.url || ""}
            alt={alt}
            fill
            sizes={compact ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 100vw, 1200px"}
            className={imageClassName || "object-cover object-center"}
            fallbackClassName={fallbackClassName || imageClassName || "object-contain object-center bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(10,10,14,0.98))] p-8"}
            draggable={false}
            loading={compact ? "lazy" : "eager"}
          />
        </div>
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
