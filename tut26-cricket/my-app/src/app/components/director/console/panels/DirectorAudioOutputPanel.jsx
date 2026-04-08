import { FaHeadphones } from "react-icons/fa";
import { Card } from "../DirectorConsoleChrome";

/**
 * File overview:
 * Purpose: Renders the static audio-output guidance panel for the director console.
 * Main exports: DirectorAudioOutputPanel.
 * Major callers: DirectorConsoleScreen.
 * Side effects: none in this render-only panel.
 * Read next: ./README.md
 */

export default function DirectorAudioOutputPanel() {
  return (
    <Card
      title="Audio output"
      subtitle="Current playback route"
      icon={<FaHeadphones />}
      accent="amber"
      help={{
        title: "Audio output",
        body: "This shows where your audio is playing. Connect the phone to a Bluetooth speaker first for louder PA playback.",
      }}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-rose-300/16 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.16),transparent_36%),linear-gradient(180deg,rgba(52,18,24,0.34),rgba(18,6,10,0.22))] px-4 py-4">
          <p className="text-sm font-semibold text-white">How to use it</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
            <li>1. Connect your phone to a Bluetooth speaker.</li>
            <li>2. Keep the speaker volume up.</li>
            <li>3. Use PA mic, music, or sound effects from this page.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
