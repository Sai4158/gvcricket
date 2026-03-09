"use client";

import {
  FaMicrophone,
  FaPlay,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";

const MODES = [
  { value: "full", label: "Full Commentary" },
  { value: "simple", label: "Simple Calls" },
  { value: "silent", label: "Silent" },
];

export default function AnnouncementControls({
  title,
  subtitle,
  settings,
  updateSetting,
  onAnnounceNow,
  onToggleEnabled,
  statusText = "",
  announceLabel = "Read current score",
  announceDisabled = false,
  announceHint = "",
}) {
  const nextEnabled = !settings.enabled;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(8,8,12,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/12 text-lg text-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
            <FaMicrophone />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => {
            onToggleEnabled?.(nextEnabled);
            updateSetting("enabled", nextEnabled);
          }}
          className={`inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
            settings.enabled
              ? "bg-emerald-500 text-black shadow-[0_12px_30px_rgba(16,185,129,0.28)]"
              : "bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]"
          }`}
        >
          {!settings.enabled ? <FaPlay /> : null}
          {settings.enabled ? "Stop Commentary" : "Start Commentary"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${
            settings.enabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700 bg-zinc-900/80 text-zinc-400"
          }`}
        >
          {settings.enabled ? "Live Commentary" : "Ready"}
        </span>
        {statusText ? <p className="text-xs text-zinc-500">{statusText}</p> : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Mode
          </span>
          <select
            value={settings.mode}
            onChange={(event) => updateSetting("mode", event.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none"
          >
            {MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Volume
          </span>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
            <button
              onClick={() => updateSetting("muted", !settings.muted)}
              className="text-zinc-300 hover:text-white"
              aria-label={settings.muted ? "Unmute announcements" : "Mute announcements"}
            >
              {settings.muted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(event) =>
                updateSetting("volume", Number(event.target.value))
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {onAnnounceNow ? (
        <div className="mt-5 space-y-2">
          <button
            onClick={onAnnounceNow}
            disabled={announceDisabled}
            className={`inline-flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
              announceDisabled
                ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                : "bg-[linear-gradient(135deg,#fde047,#f59e0b)] text-black shadow-[0_14px_32px_rgba(245,158,11,0.22)] hover:-translate-y-0.5"
            }`}
          >
            <FaVolumeUp />
            {announceLabel}
          </button>
          {announceHint ? (
            <p className="text-xs text-zinc-500">{announceHint}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
