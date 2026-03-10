"use client";

import { useState } from "react";
import { FaPlay } from "react-icons/fa";

export default function YouTubeVideoPlayer({ videoId, title }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <figure className="overflow-hidden rounded-3xl bg-zinc-900 shadow-lg shadow-black/40 ring-1 ring-white/10 transition-all duration-300 hover:ring-yellow-400/40">
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
            className="group relative h-full w-full overflow-hidden bg-black text-left"
            aria-label={`Play ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.5))]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md transition group-hover:scale-105 group-hover:bg-black/65">
                <FaPlay className="ml-1 h-5 w-5" />
              </span>
            </div>
          </button>
        )}
      </div>
      <figcaption className="p-4 text-center font-medium text-zinc-300 transition-colors">
        {title}
      </figcaption>
    </figure>
  );
}
