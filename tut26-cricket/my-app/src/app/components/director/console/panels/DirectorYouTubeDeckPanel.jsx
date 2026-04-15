/**
 * File overview:
 * Purpose: Renders Director UI for the app's screens and flows.
 * Main exports: DirectorYouTubeDeckPanel.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import {
  FaCompactDisc,
  FaExternalLinkAlt,
  FaForward,
  FaHeadphones,
  FaMusic,
  FaPause,
  FaPlay,
  FaStop,
  FaTrash,
  FaYoutube,
} from "react-icons/fa";
import LoadingButton from "../../../shared/LoadingButton";
import { buildYouTubeThumbnailUrl } from "../director-console-utils";
import { Card } from "../DirectorConsoleChrome";



export default function DirectorYouTubeDeckPanel({ musicDeck, speakerMessage }) {
  const {
    audioRef,
    currentTrack,
    currentTrackIndex,
    directorAudioMode,
    handleAddMusicTrack,
    handleNextMusic,
    handlePasteMusicLink,
    handleRemoveMusicTrack,
    handleSelectMusicTrack,
    handleStopMusic,
    handleToggleMusicPlayback,
    isAddingMusicTrack,
    isPlaylistInput,
    musicInput,
    musicMessage,
    musicPlayerError,
    musicPlayerReady,
    musicState,
    musicTrackRowRefs,
    musicTracks,
    musicVolume,
    setDirectorAudioMode,
    setMusicInput,
    setMusicVolume,
    youtubePlayerHostRef,
  } = musicDeck;

  return (
    <>
      <Card
        title="YouTube Deck"
        subtitle="Videos and playlists"
        icon={<FaYoutube />}
        accent="cyan"
        help={{
          title: "YouTube Deck",
          body: "Paste a YouTube video or playlist, then play it right here.",
        }}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-red-300/16 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 shadow-[0_10px_30px_rgba(239,68,68,0.14)]">
            <FaYoutube className="text-base text-red-300" />
            YouTube
          </span>
        }
      >
        <audio ref={audioRef} hidden />
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.34),rgba(10,10,14,0.52))] p-3">
            <label
              htmlFor="director-youtube-input"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
            >
              Paste video or playlist
            </label>
            <p className="mt-2 text-sm text-zinc-400">
              Open YouTube, copy the link, then paste it here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://www.youtube.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-red-300/16 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/16"
              >
                <FaYoutube className="text-sm text-red-300" />
                Open YouTube
              </a>
              <button
                type="button"
                onClick={() => void handlePasteMusicLink()}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
              >
                Paste link
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="director-youtube-input"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={musicInput}
                onChange={(event) => setMusicInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddMusicTrack();
                  }
                }}
                placeholder={
                  isPlaylistInput
                    ? "https://youtube.com/playlist?list=..."
                    : "https://youtube.com/watch?v=..."
                }
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/26 focus:bg-white/7"
              />
              <LoadingButton
                type="button"
                onClick={() => void handleAddMusicTrack()}
                loading={isAddingMusicTrack}
                pendingLabel={isPlaylistInput ? "Importing..." : "Adding..."}
                disabled={!String(musicInput || "").trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_100%)] px-4 py-3 text-sm font-semibold text-black shadow-[0_14px_34px_rgba(34,211,238,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPlaylistInput ? <FaYoutube /> : <FaCompactDisc />}
                {isPlaylistInput ? "Import playlist" : "Add video"}
              </LoadingButton>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-1.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDirectorAudioMode("cut")}
                aria-pressed={directorAudioMode === "cut"}
                className={`rounded-[20px] px-4 py-3 text-left transition ${
                  directorAudioMode === "cut"
                    ? "bg-[linear-gradient(135deg,rgba(127,29,29,0.9),rgba(239,68,68,0.18))] text-white shadow-[0_14px_28px_rgba(127,29,29,0.18)]"
                    : "bg-transparent text-zinc-300 hover:bg-white/4"
                }`}
              >
                <p className="text-sm font-semibold">Cut music</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Pause YouTube for score calls, then resume.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDirectorAudioMode("duck")}
                aria-pressed={directorAudioMode === "duck"}
                className={`rounded-[20px] px-4 py-3 text-left transition ${
                  directorAudioMode === "duck"
                    ? "bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(34,211,238,0.16))] text-white shadow-[0_14px_28px_rgba(8,145,178,0.18)]"
                    : "bg-transparent text-zinc-300 hover:bg-white/4"
                }`}
              >
                <p className="text-sm font-semibold">Duck music</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Keep YouTube on and lower it under score calls.
                </p>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.38),rgba(10,10,14,0.52))]">
            <div className="relative aspect-video bg-black">
              {currentTrack ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      currentTrack.thumbnailUrl ||
                      buildYouTubeThumbnailUrl(currentTrack.videoId)
                    }
                    alt={currentTrack.name}
                    className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
                      musicState === "playing" && musicPlayerReady
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.62))] transition ${
                      musicState === "playing" && musicPlayerReady
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  />
                </>
              ) : null}
              <div
                ref={youtubePlayerHostRef}
                className={`h-full w-full transition ${
                  currentTrack ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{ pointerEvents: "none" }}
              />
              {!currentTrack ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-zinc-300">
                    <FaMusic className="text-lg" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      No video loaded
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Paste a YouTube link to start.
                    </p>
                  </div>
                </div>
              ) : currentTrack && (!musicPlayerReady || musicPlayerError) ? (
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      currentTrack.thumbnailUrl ||
                      buildYouTubeThumbnailUrl(currentTrack.videoId)
                    }
                    alt={currentTrack.name}
                    className="h-full w-full object-cover opacity-72"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.78))]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
                    <p className="text-lg font-semibold text-white">
                      {musicPlayerError || "Loading player..."}
                    </p>
                    <p className="max-w-xs text-sm text-zinc-300">
                      If it takes too long, open the video in YouTube and paste
                      another link.
                    </p>
                    <a
                      href={currentTrack.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
                    >
                      <FaExternalLinkAlt className="text-xs" />
                      Open on YouTube
                    </a>
                  </div>
                </div>
              ) : null}
              {currentTrack ? (
                <button
                  type="button"
                  onClick={handleToggleMusicPlayback}
                  className="absolute inset-0 z-10 flex items-center justify-center"
                  aria-label={
                    musicState === "playing" ? "Pause video" : "Play video"
                  }
                >
                  <div
                    className={`inline-flex h-18 w-18 items-center justify-center rounded-full border border-white/18 shadow-[0_16px_36px_rgba(0,0,0,0.32)] transition ${
                      musicState === "playing" && musicPlayerReady
                        ? "bg-black/28 text-white/92 opacity-0 hover:opacity-100"
                        : "bg-white/16 text-white opacity-100 backdrop-blur-sm"
                    }`}
                  >
                    {musicState === "playing" && musicPlayerReady ? (
                      <FaPause className="text-xl" />
                    ) : (
                      <FaPlay className="ml-1 text-xl" />
                    )}
                  </div>
                </button>
              ) : null}
              {currentTrack ? (
                <div className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/14 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88 backdrop-blur-sm">
                  <FaYoutube className="text-red-300" />
                  {musicState === "playing" && musicPlayerReady
                    ? "Tap video to pause"
                    : "Tap video to play"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,25,34,0.38),rgba(10,10,14,0.52))] px-4 py-4">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(34,211,238,0.82)_18%,rgba(59,130,246,0.76)_56%,rgba(250,204,21,0.34)_82%,rgba(0,0,0,0))]" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Now playing
                </p>
                <p className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                  {currentTrack ? currentTrack.name : "No video loaded"}
                </p>
              </div>
              {currentTrack ? (
                <a
                  href={currentTrack.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
                  aria-label="Open on YouTube"
                >
                  <FaExternalLinkAlt className="text-xs" />
                </a>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {musicMessage ||
                (musicState === "playing"
                  ? "Playing"
                  : musicState === "paused"
                    ? "Paused"
                    : "Ready")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNextMusic}
              disabled={!currentTrack || musicTracks.length < 2}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white disabled:cursor-not-allowed disabled:text-zinc-500"
              aria-label="Next track"
            >
              <FaForward />
            </button>
            <button
              type="button"
              onClick={handleStopMusic}
              disabled={!currentTrack}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/6 text-white disabled:cursor-not-allowed disabled:text-zinc-500"
              aria-label="Stop music"
            >
              <FaStop />
            </button>
          </div>

          <label className="space-y-2 pb-1">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Music volume
            </span>
            <div className="director-gradient-slider">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#38bdf8_26%,#3b82f6_52%,#facc15_78%,#f59e0b_100%)]"
                style={{ width: `${Math.round(musicVolume * 100)}%` }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={(event) =>
                  setMusicVolume(Number(event.target.value))
                }
                className="director-gradient-slider__input"
              />
            </div>
          </label>

          {musicTracks.length ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Playlist
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {musicTracks.length}{" "}
                    {musicTracks.length === 1 ? "track" : "tracks"}
                  </p>
                </div>
                {currentTrack ? (
                  <div className="rounded-full border border-emerald-300/16 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    {currentTrackIndex + 1} / {musicTracks.length}
                  </div>
                ) : null}
              </div>
              <div className="max-h-92 space-y-2 overflow-y-auto pr-1">
                {musicTracks.map((track, index) => (
                  <div
                    key={track.id}
                    ref={(node) => {
                      if (node) {
                        musicTrackRowRefs.current.set(track.id, node);
                      } else {
                        musicTrackRowRefs.current.delete(track.id);
                      }
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                      index === currentTrackIndex
                        ? "border-emerald-300/18 bg-emerald-500/10"
                        : "border-white/8 bg-white/3"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        track.thumbnailUrl ||
                        buildYouTubeThumbnailUrl(track.videoId)
                      }
                      alt={track.name}
                      className="h-12 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectMusicTrack(index)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-white">
                        {track.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                        <span className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                          #{index + 1}
                        </span>
                        {index === currentTrackIndex
                          ? musicState === "playing"
                            ? "Live"
                            : "Ready"
                          : "Tap to load"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMusicTrack(track.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-rose-500/18 hover:text-rose-100"
                      aria-label={`Remove ${track.name}`}
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-center text-sm text-zinc-400">
              Paste a YouTube video or playlist above to build the deck.
            </div>
          )}
        </div>
      </Card>

      <div className="order-5 xl:order-5 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <FaHeadphones className="text-zinc-200" />
          {speakerMessage || "Using phone speaker output."}
        </span>
      </div>
    </>
  );
}


