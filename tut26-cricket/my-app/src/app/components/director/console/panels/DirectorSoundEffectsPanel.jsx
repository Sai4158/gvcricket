import {
  FaBullhorn,
  FaChevronDown,
  FaGripVertical,
  FaMusic,
  FaPause,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import { formatAudioTime } from "../director-console-utils";
import { Card } from "../DirectorConsoleChrome";

/**
 * File overview:
 * Purpose: Renders the searchable director sound-effect deck with reorder handles and playback state.
 * Main exports: DirectorSoundEffectsPanel.
 * Major callers: DirectorConsoleScreen.
 * Side effects: none in this render-only panel.
 * Read next: ./README.md
 */

export default function DirectorSoundEffectsPanel({
  audioLibrary,
  onStopAllEffects,
  onPlayEffect,
}) {
  const {
    audioUnlocked,
    clearLibraryDragState,
    draggingLibraryId,
    effectsAudioRef,
    effectsNeedsUnlock,
    fetchAudioLibrary,
    filteredLibraryFiles,
    handleLibraryDragEnter,
    handleLibraryDragOver,
    handleLibraryDragStart,
    handleLibraryDrop,
    handleLibraryGripPointerDown,
    iOSSafari,
    libraryCurrentTime,
    libraryDropTargetId,
    libraryDurations,
    libraryFiles,
    libraryLiveId,
    libraryPanelOpen,
    librarySearchQuery,
    libraryState,
    orderedLibraryFiles,
    primeEffectsAudio,
    setConsoleError,
    setEffectsNeedsUnlock,
    setLibraryPanelOpen,
    setLibrarySearchQuery,
    usePointerLibraryReorder,
  } = audioLibrary;

  return (
    <Card
      title="Sound Effects"
      subtitle={libraryPanelOpen ? "Tap to play audio" : "Ready to fire"}
      icon={<FaBullhorn />}
      accent="violet"
      help={{
        title: "Sound Effects",
        body: "Drop audio files into public/audio/effects and they will show here automatically. Files only load when you tap them.",
      }}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setLibraryPanelOpen((current) => {
                const nextOpen = !current;
                if (nextOpen && !libraryFiles.length) {
                  void fetchAudioLibrary({ force: true });
                }
                return nextOpen;
              })
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
            aria-expanded={libraryPanelOpen}
            aria-label={
              libraryPanelOpen
                ? "Collapse sound effects"
                : "Expand sound effects"
            }
          >
            <FaChevronDown
              className={`text-sm transition ${
                libraryPanelOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onStopAllEffects}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200"
          >
            Stop audio
          </button>
        </div>
      }
    >
      <audio ref={effectsAudioRef} hidden preload="metadata" playsInline />
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,16,30,0.36),rgba(10,10,14,0.32))] p-2">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(192,132,252,0.84)_18%,rgba(59,130,246,0.42)_76%,rgba(0,0,0,0))]" />
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
          <div className="min-w-0">
            <p className="font-semibold text-white">
              {String(librarySearchQuery || "").trim()
                ? `${filteredLibraryFiles.length} of ${orderedLibraryFiles.length} effects`
                : `${orderedLibraryFiles.length} effects ready`}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {libraryLiveId
                ? "Tap the active pad again or use Stop audio."
                : "Open the deck when you need quick pads."}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setLibraryPanelOpen((current) => {
                const nextOpen = !current;
                if (nextOpen && !libraryFiles.length) {
                  void fetchAudioLibrary({ force: true });
                }
                return nextOpen;
              })
            }
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/10"
          >
            {libraryPanelOpen ? "Hide" : "Open"}
            <FaChevronDown
              className={`text-[10px] transition ${
                libraryPanelOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
        {effectsNeedsUnlock ? (
          <div className="mb-3 rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p>Safari needs one quick tap to enable audio playback on this device.</p>
            <button
              type="button"
              onClick={() => {
                void primeEffectsAudio().then(() => {
                  setEffectsNeedsUnlock(false);
                  setConsoleError("");
                });
              }}
              className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Enable Audio
            </button>
          </div>
        ) : null}
        {!effectsNeedsUnlock && iOSSafari && !audioUnlocked ? (
          <div className="mb-3 rounded-[22px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-300">
            Tap any sound once to enable audio on this iPhone or iPad.
          </div>
        ) : null}
        <div className="mb-3 rounded-[22px] border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-300">
          Turn off silent mode to hear sound effects
        </div>
        {libraryPanelOpen && orderedLibraryFiles.length ? (
          <>
            <div className="relative mb-3">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <FaSearch className="text-xs" />
              </span>
              <input
                type="search"
                inputMode="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={librarySearchQuery}
                onChange={(event) => setLibrarySearchQuery(event.target.value)}
                placeholder="Search sound effects"
                className="w-full rounded-[22px] border border-white/10 bg-white/4 py-3 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-300/24 focus:bg-white/6"
                aria-label="Search director sound effects"
              />
              {String(librarySearchQuery || "").trim() ? (
                <button
                  type="button"
                  onClick={() => setLibrarySearchQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10"
                  aria-label="Clear sound effect search"
                >
                  <FaTimes className="text-xs" />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredLibraryFiles.map((file) => (
                <div
                  key={file.id}
                  data-library-effect-id={file.id}
                  draggable={!usePointerLibraryReorder}
                  onDragStart={(event) => handleLibraryDragStart(event, file.id)}
                  onDragEnter={() => handleLibraryDragEnter(file.id)}
                  onDragOver={(event) => handleLibraryDragOver(event, file.id)}
                  onDrop={(event) => handleLibraryDrop(event, file.id)}
                  onDragEnd={clearLibraryDragState}
                  onClick={() => void onPlayEffect(file)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void onPlayEffect(file);
                    }
                  }}
                  className={`group relative min-h-47 overflow-hidden rounded-3xl border px-4 py-4 pb-5 text-left transition select-none ${
                    libraryLiveId === file.id
                      ? "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(18,40,34,0.9),rgba(10,16,18,0.94))] shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                      : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  } ${
                    draggingLibraryId === file.id
                      ? "scale-[0.985] opacity-72 shadow-[0_20px_50px_rgba(0,0,0,0.34)]"
                      : ""
                  } ${
                    libraryDropTargetId === file.id
                      ? "border-emerald-300/40 ring-2 ring-emerald-400/20"
                      : ""
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-white/18 to-transparent" />
                  <div className="flex h-full flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/90">
                          <FaMusic className="text-sm" />
                        </div>
                        <span
                          role="button"
                          tabIndex={-1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400"
                          title={
                            usePointerLibraryReorder
                              ? "Drag this handle to reorder"
                              : "Drag to reorder"
                          }
                          onPointerDown={(event) =>
                            handleLibraryGripPointerDown(event, file.id)
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onDragStart={(event) => {
                            if (usePointerLibraryReorder) {
                              event.preventDefault();
                            }
                          }}
                          style={{
                            touchAction: usePointerLibraryReorder
                              ? "none"
                              : "auto",
                            userSelect: "none",
                            WebkitTouchCallout: "none",
                            WebkitUserSelect: "none",
                          }}
                        >
                          <FaGripVertical className="text-sm" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                          {file.label}
                        </div>
                        <div className="truncate text-xs text-zinc-400">
                          {file.fileName}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="space-y-1 pb-1 text-xs text-zinc-400">
                        {libraryLiveId === file.id
                          ? libraryState === "loading"
                            ? "Loading..."
                            : "Playing"
                          : "Tap to play"}
                        <div className="text-[11px] text-zinc-500">
                          {libraryLiveId === file.id
                            ? `${formatAudioTime(libraryCurrentTime)} / ${formatAudioTime(
                                libraryDurations[file.id] || 0,
                              )}`
                            : formatAudioTime(libraryDurations[file.id] || 0)}
                        </div>
                      </div>
                      {libraryLiveId === file.id ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onStopAllEffects();
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                          aria-label={`Stop ${file.label}`}
                        >
                          {libraryState === "loading" ? (
                            <FaMusic className="text-xs" />
                          ) : (
                            <FaPause className="text-xs" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filteredLibraryFiles.length ? (
              <div className="mt-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-left text-sm text-zinc-400">
                No sound effects match &quot;{librarySearchQuery.trim()}&quot;.
              </div>
            ) : null}
          </>
        ) : libraryPanelOpen ? (
          <button
            type="button"
            onClick={() => {
              void fetchAudioLibrary({ force: true });
            }}
            className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-5 text-left text-sm text-zinc-400"
          >
            Load audio files from{" "}
            <span className="font-semibold text-zinc-200">
              public/audio/effects
            </span>{" "}
            when you want to refresh this deck.
          </button>
        ) : null}
      </div>
    </Card>
  );
}
