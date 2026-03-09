"use client";

import Link from "next/link";

export default function PrimaryActionsSection() {
  return (
    <section className="w-full max-w-3xl mx-auto flex flex-col items-center gap-12 text-center">
      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
          Built for the Community, by the Community.
        </h2>
        <p className="text-lg text-zinc-300 leading-relaxed">
          Make scoring simple, fast, and accessible to everyone in{" "}
          <strong className="text-white">real time.</strong>
        </p>
      </div>
      <div className="w-full max-w-md flex flex-col gap-5">
        <Link
          href="/session/new"
          className="
            text-center py-4 rounded-2xl text-black text-2xl font-bold
            shadow-lg shadow-amber-900/40
            hover:scale-105 transition-all duration-300
            animate-[animate-gradient-slow_8s_ease-in-out_infinite]
          "
          style={{
            backgroundSize: "200% auto",
            backgroundImage:
              "linear-gradient(to right, #facc15, #f59e0b, #fb923c, #f59e0b, #facc15)",
          }}
        >
          Launch Umpire <br /> View
        </Link>
        <Link
          href="/session"
          className="
            text-center py-4 rounded-2xl text-black text-2xl font-bold
            shadow-lg shadow-amber-900/40
            hover:scale-105 transition-all duration-300
            animate-[animate-gradient-slow_8s_ease-in-out_infinite]
          "
          style={{
            backgroundSize: "200% auto",
            backgroundImage:
              "linear-gradient(to right, #facc15, #d97706, #fde047, #d97706, #facc15)",
          }}
        >
          View Past/Live <br /> Sessions
        </Link>
        <Link
          href="/rules"
          className="
            text-center py-4 rounded-2xl bg-zinc-700 text-white/80 text-2xl font-bold
            ring-1 ring-zinc-600
            hover:scale-105 transition-all duration-300
            hover:bg-zinc-600 hover:text-white
            animate-[animate-glow_4s_ease-in-out_infinite]
          "
        >
          View All Rules!
        </Link>
      </div>
    </section>
  );
}
