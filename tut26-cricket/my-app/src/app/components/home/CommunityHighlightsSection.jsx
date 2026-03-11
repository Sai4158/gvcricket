"use client";

import AnimatedSection from "./AnimatedSection";
import YouTubeVideoPlayer from "./YouTubeVideoPlayer";

const communityVideos = [
  { videoId: "FztXLCMn0SQ", title: "Highlight 1" },
  { videoId: "foHic_QfJuU", title: "Highlight 2" },
  { videoId: "xEeLV0M78b4", title: "Highlight 3" },
  { videoId: "LlJZ0WJteSU", title: "Highlight 4 (Short)" },
];

export default function CommunityHighlightsSection() {
  return (
    <AnimatedSection
      id="community-highlights"
      className="w-full max-w-6xl mx-auto flex flex-col items-center"
    >
      <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-16 text-center text-white">
        From the Community
      </h2>
      <p className="text-lg text-white/78 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16">
        It all started in 2022 with a few friends who loved the game. Today,
        it&apos;s a friendly league of over{" "}
        <strong className="text-white">50+ members</strong> who meet for fun,
        competitive cricket.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8 w-full">
        {communityVideos.map((video) => (
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
