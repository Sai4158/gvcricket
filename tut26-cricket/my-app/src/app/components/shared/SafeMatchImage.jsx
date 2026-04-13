"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: SafeMatchImage, resolveSafeMatchImage, GV_MATCH_FALLBACK_IMAGE.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  isSafeMatchImageUrl,
  isSafeRemoteMatchImageUrl,
} from "../../lib/match-image";

export const GV_MATCH_FALLBACK_IMAGE = "/gvLogo.png";

export function resolveSafeMatchImage(src) {
  return isSafeMatchImageUrl(src) ? src : GV_MATCH_FALLBACK_IMAGE;
}

export default function SafeMatchImage({
  src = "",
  alt = "",
  className = "",
  fallbackClassName = "",
  onFallbackChange,
  ...imageProps
}) {
  const {
    draggable = false,
    onDragStart,
    style,
    ...restImageProps
  } = imageProps;
  const resolvedSrc = useMemo(() => resolveSafeMatchImage(src), [src]);
  const [imageSrc, setImageSrc] = useState(resolvedSrc);
  const [isFallback, setIsFallback] = useState(
    resolvedSrc === GV_MATCH_FALLBACK_IMAGE
  );

  useEffect(() => {
    setImageSrc(resolvedSrc);
    setIsFallback(resolvedSrc === GV_MATCH_FALLBACK_IMAGE);
  }, [resolvedSrc]);

  useEffect(() => {
    onFallbackChange?.(isFallback);
  }, [isFallback, onFallbackChange]);

  const shouldBypassOptimization =
    imageProps.unoptimized ??
    (imageSrc === GV_MATCH_FALLBACK_IMAGE ||
      (imageSrc !== GV_MATCH_FALLBACK_IMAGE &&
        (isSafeRemoteMatchImageUrl(imageSrc) || isSafeMatchImageUrl(imageSrc))));

  return (
    <Image
      {...restImageProps}
      src={imageSrc}
      alt={alt}
      unoptimized={shouldBypassOptimization}
      draggable={draggable}
      className={isFallback && fallbackClassName ? fallbackClassName : className}
      style={
        draggable
          ? style
          : {
              WebkitUserDrag: "none",
              userSelect: "none",
              ...style,
            }
      }
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
        }
        onDragStart?.(event);
      }}
      onError={() => {
        if (imageSrc === GV_MATCH_FALLBACK_IMAGE) {
          return;
        }
        setImageSrc(GV_MATCH_FALLBACK_IMAGE);
        setIsFallback(true);
      }}
    />
  );
}


