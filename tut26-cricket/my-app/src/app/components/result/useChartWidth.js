"use client";

import { useEffect, useRef, useState } from "react";

export default function useChartWidth() {
  const containerRef = useRef(null);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(0, Math.floor(element.getBoundingClientRect().width));
      if (nextWidth === widthRef.current) {
        return;
      }
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    };

    updateWidth();

    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => updateWidth())
        : null;

    observer?.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  return [containerRef, width];
}
