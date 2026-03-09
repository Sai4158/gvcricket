"use client";

import { useEffect, useRef, useState } from "react";

export default function useChartWidth() {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
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

  return { containerRef, width };
}
