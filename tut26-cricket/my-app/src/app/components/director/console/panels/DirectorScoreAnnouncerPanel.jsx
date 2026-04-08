import { FaVolumeUp } from "react-icons/fa";
import { Card, IosSwitch } from "../DirectorConsoleChrome";

/**
 * File overview:
 * Purpose: Renders score-announcer enablement and manual read-current-score controls.
 * Main exports: DirectorScoreAnnouncerPanel.
 * Major callers: DirectorConsoleScreen.
 * Side effects: none in this render-only panel.
 * Read next: ./README.md
 */

export default function DirectorScoreAnnouncerPanel({
  canManageSession,
  readCurrentScore,
  setSpeechSettings,
  speech,
  speechSettings,
}) {
  return (
    <Card
      title="Score announcer"
      subtitle="Live score readout"
      icon={<FaVolumeUp />}
      accent="violet"
      help={{
        title: "Score announcer",
        body: "Keep score announcements on for the managed session. Use read current score any time for a quick update.",
      }}
      action={
        <IosSwitch
          checked={speechSettings.enabled}
          label="Score announcer"
          onChange={(nextChecked) =>
            setSpeechSettings((current) => ({
              ...current,
              enabled: nextChecked,
            }))
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,16,46,0.38),rgba(10,10,14,0.52))] px-4 py-4">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.82)_18%,rgba(34,211,238,0.42)_76%,rgba(0,0,0,0))]" />
          <p className="text-sm text-zinc-300">
            {speechSettings.enabled
              ? "Score announcer is on."
              : "Score announcer is off."}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Tap Read current score any time for a manual update.
          </p>
          {speech.needsGesture && !speech.audioUnlocked ? (
            <p className="mt-2 text-sm text-amber-200">
              Tap Read current score once to enable iPhone audio.
            </p>
          ) : null}
          {speech.status === "blocked" ? (
            <p className="mt-2 text-sm text-rose-200">
              Audio is blocked in this browser right now.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={readCurrentScore}
          disabled={!canManageSession}
          className="w-full rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/4 disabled:text-zinc-500 disabled:hover:translate-y-0"
        >
          {canManageSession ? "Read current score" : "Choose session first"}
        </button>
      </div>
    </Card>
  );
}
