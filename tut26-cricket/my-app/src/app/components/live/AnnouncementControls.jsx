"use client";

import { FaVolumeMute, FaVolumeUp } from "react-icons/fa";

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
  showAccessibility = false,
  onAnnounceNow,
}) {
  return (
    <section className="bg-zinc-900/60 ring-1 ring-white/10 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>}
        </div>
        <button
          onClick={() => updateSetting("enabled", !settings.enabled)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            settings.enabled
              ? "bg-emerald-500 text-black"
              : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {settings.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Mode
          </span>
          <select
            value={settings.mode}
            onChange={(event) => updateSetting("mode", event.target.value)}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none"
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
          <div className="flex items-center gap-3 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2">
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

        {showAccessibility && (
          <label className="flex items-center justify-between rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 sm:col-span-2">
            <span className="text-sm text-zinc-200">Accessibility feedback</span>
            <input
              type="checkbox"
              checked={settings.accessibilityMode}
              onChange={(event) =>
                updateSetting("accessibilityMode", event.target.checked)
              }
            />
          </label>
        )}
      </div>

      {onAnnounceNow && (
        <button
          onClick={onAnnounceNow}
          className="mt-4 text-sm font-medium text-amber-300 hover:text-amber-200"
        >
          Read current score
        </button>
      )}
    </section>
  );
}
