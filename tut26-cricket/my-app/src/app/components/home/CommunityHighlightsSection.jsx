"use client";

import AnimatedSection from "./AnimatedSection";
import YouTubeVideoPlayer from "./YouTubeVideoPlayer";

const demoVideos = [
  { videoId: "FztXLCMn0SQ", title: "Live scoring demo" },
  { videoId: "foHic_QfJuU", title: "Spectator view demo" },
  { videoId: "xEeLV0M78b4", title: "Match flow demo" },
  { videoId: "LlJZ0WJteSU", title: "Quick clip" },
];

export default function CommunityHighlightsSection() {
  return (
    <AnimatedSection
      id="product-demo"
      className="w-full max-w-6xl mx-auto flex flex-col items-center"
    >
      <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-16 text-center text-white">
        See the app in action
      </h2>
      <p className="text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16">
        Watch how live scoring, spectator view, and match flow feel in real use. Fast setup, clean controls, and instant updates stay front and center.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8 w-full">
        {demoVideos.map((video) => (
          <YouTubeVideoPlayer
            key={video.videoId}
            videoId={video.videoId}
            title={video.title}
          />
        ))}
      </div>
    </AnimatedSection>
  );
}
