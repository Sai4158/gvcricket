"use client";

import { motion, useReducedMotion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import YouTubeVideoPlayer from "./YouTubeVideoPlayer";

const demoVideos = [
  { videoId: "FztXLCMn0SQ", title: "GV Community Highlight 1" },
  { videoId: "foHic_QfJuU", title: "GV Community Highlight 2" },
  { videoId: "xEeLV0M78b4", title: "GV Community Highlight 3" },
  { videoId: "LlJZ0WJteSU", title: "Quick clip" },
];

export default function CommunityHighlightsSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatedSection
      id="product-demo"
      direction="right"
      className="w-full max-w-6xl mx-auto flex flex-col items-center"
    >
      <motion.h2
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, y: 30, scale: 0.985, filter: "blur(10px)" }
        }
        whileInView={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
        className="text-5xl md:text-7xl font-bold tracking-tight mb-16 text-center text-white"
      >
        See the app in action
      </motion.h2>
      <motion.p
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, y: 28, filter: "blur(8px)" }
        }
        whileInView={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.74, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        className="text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16"
      >
        Watch how live scoring, spectator view, and match flow feel in real use. Fast setup, clean controls, and instant updates stay front and center.
      </motion.p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8 w-full">
        {demoVideos.map((video, index) => (
          <YouTubeVideoPlayer
            key={video.videoId}
            videoId={video.videoId}
            title={video.title}
            index={index}
          />
        ))}
      </div>
    </AnimatedSection>
  );
}
