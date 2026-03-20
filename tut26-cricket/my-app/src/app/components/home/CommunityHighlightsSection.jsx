"use client";

import { motion, useReducedMotion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import LiquidSportText from "./LiquidSportText";
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
      className="mx-auto flex w-full max-w-6xl flex-col items-center xl:max-w-7xl 2xl:max-w-[108rem]"
    >
      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, y: 22, scale: 0.992, filter: "blur(6px)" }
        }
        whileInView={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
        transition={{ duration: 0.64, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16"
      >
        <LiquidSportText
          text={["From the", "Community"]}
          characterTyping
          characterStagger={0.022}
          characterLineDelay={0.16}
          className="text-center text-5xl font-bold tracking-tight md:text-7xl"
          lineClassName="leading-[0.96]"
        />
      </motion.div>
      <motion.p
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, y: 18, filter: "blur(5px)" }
        }
        whileInView={
          prefersReducedMotion
            ? undefined
            : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        viewport={{ once: true, amount: 0.02, margin: "0px 0px 14% 0px" }}
        transition={{ duration: 0.6, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        className="text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16"
      >
        It all started in 2022 with a few friends who loved the game. Today, GV Cricket is actively being used by a friendly league of over 50+ members who meet for fun, competitive cricket.
      </motion.p>
      <div className="grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:gap-10 2xl:gap-12">
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
