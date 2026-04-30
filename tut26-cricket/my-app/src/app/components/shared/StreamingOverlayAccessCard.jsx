"use client";

import { FaCheck, FaShareAlt } from "react-icons/fa";

export default function StreamingOverlayAccessCard({
  overlayUrl = "",
  onCopy,
  onOpen,
  copied = false,
  title = "YouTube Streaming Overlay",
  description = "Use this link as a Browser Source for the live score overlay.",
  className = "",
}) {
  if (!overlayUrl) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(225,29,46,0.14),transparent_26%),linear-gradient(180deg,rgba(20,20,20,0.96),rgba(9,9,9,0.98))] shadow-[0_20px_50px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,#e11d2e_0%,#ffffff_52%,#f7c948_100%)]" />
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300 sm:tracking-[0.24em]">
              {title}
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/12"
            >
              {copied ? <FaCheck /> : <FaShareAlt />}
              {copied ? "Copied" : "Copy Link"}
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/14"
            >
              Open
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="break-all font-mono text-sm text-white">{overlayUrl}</p>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3">
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#05070c] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <div className="relative aspect-[16/9] bg-[radial-gradient(circle_at_top,rgba(225,29,46,0.18),transparent_46%),linear-gradient(180deg,#0b0d14,#05070c)]">
              <div className="absolute left-4 top-4 h-8 w-8 rounded-full bg-[linear-gradient(180deg,#7f1d1d,#2a0808)] shadow-[0_0_18px_rgba(225,29,46,0.28)]" />
              <div className="absolute bottom-0 left-0 right-0 h-[34%] bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(7,10,18,0.95)_48%)]" />
              <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[linear-gradient(90deg,#12080a,#1f0b10,#12080a)] px-4 py-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300">
                      Preview
                    </p>
                    <p className="mt-1 text-lg font-black uppercase text-white">
                      Team A 84/2
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
                      Overs 8.4
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {["1", "4", "Wd", "2"].map((ball) => (
                      <span
                        key={ball}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,#7f1d1d,#2a0808)] text-xs font-black text-white"
                      >
                        {ball}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
