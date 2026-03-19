"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FaPlay } from "react-icons/fa";

export default function YouTubeVideoPlayer({ videoId, title, index = 0 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const initialMotion = prefersReducedMotion
    ? false
    : {
        opacity: 0,
        scale: 0.99,
        x: index % 2 === 0 ? -30 : 30,
        y: 18,
        rotate: index % 2 === 0 ? -0.5 : 0.5,
        filter: "blur(6px)",
      };
  const visibleMotion = prefersReducedMotion
    ? undefined
    : {
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        rotate: 0,
        filter: "blur(0px)",
      };

  return (
    <motion.figure
      initial={initialMotion}
      whileInView={visibleMotion}
      viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.66, ease: [0.22, 1, 0.36, 1] }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
      className="liquid-glass group relative overflow-hidden rounded-[30px] p-2.5 transition-all duration-300 hover:border-white/28 hover:shadow-[0_18px_48px_rgba(0,0,0,0.32)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,210,130,0.12),transparent_30%)] opacity-90" />
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
        <div className="aspect-video">
        {isPlaying ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="relative h-full w-full overflow-hidden bg-black/20 text-left"
            aria-label={`Play ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="liquid-pill flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/24 bg-white/14 text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)] transition group-hover:scale-105">
                <FaPlay className="ml-1 h-5 w-5" />
              </span>
            </div>
          </button>
        )}
        </div>
      </div>
      <figcaption className="relative mt-2 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-[15px] font-medium text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors">
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
        <span className="relative">{title}</span>
      </figcaption>
    </motion.figure>
  );
}
