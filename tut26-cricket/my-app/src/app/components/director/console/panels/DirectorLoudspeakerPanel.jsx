import { FaMicrophone } from "react-icons/fa";
import {
  Card,
  HOLD_BUTTON_INTERACTION_PROPS,
  IosSwitch,
} from "../DirectorConsoleChrome";

/**
 * File overview:
 * Purpose: Renders the director loudspeaker hold-to-talk panel.
 * Main exports: DirectorLoudspeakerPanel.
 * Major callers: DirectorConsoleScreen.
 * Side effects: none in this render-only panel.
 * Read next: ./README.md
 */

export default function DirectorLoudspeakerPanel({ loudspeaker, micMonitor }) {
  const {
    directorMicLive,
    directorMicPointerIdRef,
    directorSpeakerOn,
    handleDirectorMicStart,
    handleDirectorMicStop,
    handleDirectorSpeakerSwitchChange,
  } = loudspeaker;

  return (
    <Card
      title="Loudspeaker"
      subtitle={
        directorMicLive
          ? "Live on speaker"
          : micMonitor.isStarting
            ? "Starting loudspeaker"
            : directorSpeakerOn
              ? "Hold to talk over loudspeaker"
              : "Turn on mic to use hold to talk"
      }
      icon={<FaMicrophone />}
      accent="amber"
      help={{
        title: "Loudspeaker",
        body: "Press and hold to speak over the phone speaker or connected Bluetooth speaker. Music and effects duck automatically while you talk.",
      }}
      action={
        <IosSwitch
          checked={directorSpeakerOn}
          label="Loudspeaker mic"
          onChange={(nextChecked) => {
            void handleDirectorSpeakerSwitchChange(nextChecked);
          }}
        />
      }
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.24),rgba(10,10,14,0.46))] px-4 py-5">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(251,191,36,0.84)_20%,rgba(34,211,238,0.42)_75%,rgba(0,0,0,0))]" />
        <div
          className="flex flex-col items-center gap-4 text-center"
          style={{
            userSelect: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
          }}
        >
          {!directorSpeakerOn ? (
            <div className="w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
              Turn on the loudspeaker mic to use hold to talk.
            </div>
          ) : null}
          <button
            type="button"
            disabled={!directorSpeakerOn}
            {...HOLD_BUTTON_INTERACTION_PROPS}
            onPointerDown={(event) => {
              if (!event.isPrimary) return;
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              directorMicPointerIdRef.current = event.pointerId;
              event.currentTarget.setPointerCapture?.(event.pointerId);
              void handleDirectorMicStart();
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture?.(event.pointerId);
            }}
            onPointerCancel={(event) => {
              event.preventDefault();
              event.currentTarget.releasePointerCapture?.(event.pointerId);
              directorMicPointerIdRef.current = null;
              void handleDirectorMicStop();
            }}
            className={`relative inline-flex h-28 w-28 items-center justify-center rounded-full border text-3xl transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${
              !directorSpeakerOn
                ? "cursor-not-allowed border-white/8 bg-white/3 text-zinc-500"
                : directorMicLive
                  ? "border-emerald-300 bg-emerald-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.34)]"
                  : "border-white/10 bg-white/5 text-white"
            }`}
            aria-label="Hold to talk on loudspeaker"
          >
            <span
              className={`absolute -inset-2 rounded-full border ${
                directorSpeakerOn && directorMicLive
                  ? "animate-pulse border-emerald-300/35"
                  : "border-transparent"
              }`}
            />
            <FaMicrophone />
          </button>
          <div
            style={{
              userSelect: "none",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
            }}
          >
            <p className="text-lg font-semibold text-white">
              {!directorSpeakerOn
                ? "Turn on to talk"
                : micMonitor.isStarting
                  ? "Starting..."
                  : directorMicLive
                    ? "Release to stop"
                    : "Hold to talk"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {directorSpeakerOn
                ? "Music and effects duck while you speak."
                : "Mic stays off until you enable it on this device."}
            </p>
          </div>
          {micMonitor.error ? (
            <p className="text-sm text-rose-300">{micMonitor.error}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
