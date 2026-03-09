"use client";

export default function YouTubeVideoPlayer({ videoId, title }) {
  return (
    <figure className="overflow-hidden rounded-3xl ring-1 ring-white/10 bg-zinc-900 shadow-lg shadow-black/40 flex flex-col group hover:ring-yellow-400/50 transition-all duration-300">
      <div className="aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>
      <figcaption className="p-4 text-center font-medium text-zinc-300 group-hover:text-amber-300 transition-colors">
        {title}
      </figcaption>
    </figure>
  );
}
