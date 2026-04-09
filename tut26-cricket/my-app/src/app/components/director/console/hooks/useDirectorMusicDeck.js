/**
 * File overview:
 * Purpose: Encapsulates Director browser state, effects, and runtime coordination.
 * Main exports: useDirectorMusicDeck.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useMemo } from "react";
import {
  extractYouTubePlaylistId,
  loadDirectorYouTubeIframeApi,
  readCachedDirectorYouTubeTracks,
  resolveDirectorYouTubePlaylist,
  resolveDirectorYouTubeTrack,
  writeCachedDirectorYouTubeTracks,
} from "../director-console-utils";
import { playUiTone } from "../../../../lib/page-audio";

export default function useDirectorMusicDeck({
  audioRef,
  currentTrack,
  currentTrackIndex,
  currentTrackIndexRef,
  directorAudioMode,
  directorHoldLive,
  directorMicHoldingRef,
  directorMicPointerIdRef,
  directorSpeakerOn,
  getMusicTargetVolume,
  handlePasteMusicLinkExternal,
  hasLoadedMusicTracks,
  hydrateImportedMusicTracks,
  iOSSafari,
  isAddingMusicTrack,
  loadedMusicVideoIdRef,
  micMonitor,
  musicInput,
  musicMessage,
  musicPlayerBootNonce,
  musicPlayerError,
  musicPlayerReady,
  musicState,
  musicTrackRowRefs,
  musicTracks,
  musicTracksRef,
  musicVolume,
  setCurrentTrackIndex,
  setDirectorAudioMode,
  setDirectorHoldLive,
  setDirectorSpeakerOn,
  setHasLoadedMusicTracks,
  setMusicInput,
  setMusicMessage,
  setMusicPlayerBootNonce,
  setMusicPlayerError,
  setMusicPlayerReady,
  setMusicState,
  setMusicTracks,
  setMusicVolume,
  setMusicOutputVolume,
  setSpeakerMessage,
  stopMusicDeck,
  walkie,
  youtubePlayerHostRef,
  youtubePlayerRef,
}) {
  const isPlaylistInput = useMemo(
    () => Boolean(extractYouTubePlaylistId(musicInput)),
    [musicInput],
  );

  const directorMicLive = Boolean(
    directorHoldLive || (micMonitor.isActive && !micMonitor.isPaused),
  );

  useEffect(() => {
    setMusicTracks(readCachedDirectorYouTubeTracks());
    setHasLoadedMusicTracks(true);
  }, [setHasLoadedMusicTracks, setMusicTracks]);

  useEffect(() => {
    musicTracksRef.current = musicTracks;
    if (hasLoadedMusicTracks) {
      writeCachedDirectorYouTubeTracks(musicTracks);
    }
  }, [hasLoadedMusicTracks, musicTracks, musicTracksRef]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex, currentTrackIndexRef]);

  const handlePasteMusicLink = useCallback(async () => {
    if (typeof handlePasteMusicLinkExternal === "function") {
      await handlePasteMusicLinkExternal();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setMusicMessage("Clipboard paste is not supported here.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!String(clipboardText || "").trim()) {
        setMusicMessage("Clipboard is empty.");
        return;
      }
      setMusicInput(String(clipboardText || "").trim());
      setMusicMessage("Link pasted.");
    } catch {
      setMusicMessage("Could not paste from clipboard.");
    }
  }, [handlePasteMusicLinkExternal, setMusicInput, setMusicMessage]);

  const syncMusicTrackToPlayer = useCallback(
    (track, { autoplay = false, restart = false } = {}) => {
      const player = youtubePlayerRef.current;
      if (!player || !track?.videoId) {
        return false;
      }

      setMusicPlayerError("");
      setMusicOutputVolume(getMusicTargetVolume());

      try {
        const currentVideoId = String(player.getVideoData?.().video_id || "");
        const sameVideo =
          currentVideoId === track.videoId ||
          loadedMusicVideoIdRef.current === track.videoId;

        loadedMusicVideoIdRef.current = track.videoId;

        if (autoplay) {
          if (sameVideo && !restart) {
            player.playVideo();
          } else {
            player.loadVideoById(track.videoId);
          }
          return true;
        }

        if (!sameVideo || restart) {
          player.cueVideoById(track.videoId);
        }
        return true;
      } catch {
        setMusicPlayerError("Player is still loading.");
        return false;
      }
    },
    [
      getMusicTargetVolume,
      loadedMusicVideoIdRef,
      setMusicOutputVolume,
      setMusicPlayerError,
      youtubePlayerRef,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    const mountNode = youtubePlayerHostRef.current;
    setMusicPlayerReady(false);
    setMusicPlayerError("");

    void loadDirectorYouTubeIframeApi()
      .then(() => {
        if (cancelled || !mountNode || youtubePlayerRef.current) {
          return;
        }

        mountNode.innerHTML = "";
        const playerHost = document.createElement("div");
        playerHost.className = "h-full w-full";
        mountNode.appendChild(playerHost);

        const player = new window.YT.Player(playerHost, {
          height: "100%",
          width: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            fs: 0,
            disablekb: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return;
              }

              youtubePlayerRef.current = event.target;
              setMusicPlayerReady(true);
              setMusicPlayerError("");
              setMusicOutputVolume(getMusicTargetVolume());

              const initialTrack =
                musicTracksRef.current[currentTrackIndexRef.current];
              if (initialTrack?.videoId) {
                loadedMusicVideoIdRef.current = initialTrack.videoId;
                try {
                  event.target.cueVideoById(initialTrack.videoId);
                } catch {
                  // Ignore cue failures until the user interacts.
                }
              }
            },
            onStateChange: (event) => {
              if (cancelled) {
                return;
              }

              if (event.data === window.YT.PlayerState.PLAYING) {
                const activeTrack =
                  musicTracksRef.current[currentTrackIndexRef.current];
                setMusicPlayerReady(true);
                setMusicPlayerError("");
                setMusicState("playing");
                setMusicMessage(
                  activeTrack ? `Playing ${activeTrack.name}.` : "Playing video.",
                );
                return;
              }

              if (event.data === window.YT.PlayerState.PAUSED) {
                setMusicPlayerReady(true);
                setMusicState("paused");
                return;
              }

              if (event.data === window.YT.PlayerState.BUFFERING) {
                setMusicPlayerReady(true);
                setMusicMessage("Loading video...");
                return;
              }

              if (event.data === window.YT.PlayerState.CUED) {
                setMusicPlayerReady(true);
                setMusicState((current) =>
                  current === "playing" ? current : "paused",
                );
                return;
              }

              if (event.data === window.YT.PlayerState.ENDED) {
                if (musicTracksRef.current.length > 1) {
                  const nextIndex =
                    (currentTrackIndexRef.current + 1) %
                    musicTracksRef.current.length;
                  const nextTrack = musicTracksRef.current[nextIndex];
                  currentTrackIndexRef.current = nextIndex;
                  setCurrentTrackIndex(nextIndex);
                  if (nextTrack?.videoId) {
                    loadedMusicVideoIdRef.current = nextTrack.videoId;
                    try {
                      event.target.loadVideoById(nextTrack.videoId);
                    } catch {
                      setMusicState("stopped");
                    }
                  }
                } else {
                  setMusicState("stopped");
                  setMusicMessage("Playback finished.");
                }
              }
            },
          },
        });

        youtubePlayerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) {
          setMusicPlayerReady(false);
          setMusicPlayerError("YouTube player could not load.");
          setMusicMessage("YouTube player could not load.");
        }
      });

    return () => {
      cancelled = true;
      try {
        youtubePlayerRef.current?.destroy();
      } catch {
        // Ignore destroy failures.
      }
      youtubePlayerRef.current = null;
      loadedMusicVideoIdRef.current = "";
      mountNode?.replaceChildren();
      setMusicPlayerReady(false);
    };
  }, [
    currentTrackIndexRef,
    getMusicTargetVolume,
    loadedMusicVideoIdRef,
    musicPlayerBootNonce,
    musicTracksRef,
    setCurrentTrackIndex,
    setMusicMessage,
    setMusicOutputVolume,
    setMusicPlayerError,
    setMusicPlayerReady,
    setMusicState,
    youtubePlayerHostRef,
    youtubePlayerRef,
  ]);

  useEffect(() => {
    if (!currentTrack?.videoId || !youtubePlayerRef.current) {
      return;
    }

    if (loadedMusicVideoIdRef.current === currentTrack.videoId) {
      return;
    }

    const synced = syncMusicTrackToPlayer(currentTrack, { autoplay: false });
    if (synced) {
      setMusicMessage(`Ready: ${currentTrack.name}.`);
      setMusicState("paused");
    }
  }, [
    currentTrack,
    loadedMusicVideoIdRef,
    setMusicMessage,
    setMusicState,
    syncMusicTrackToPlayer,
    youtubePlayerRef,
  ]);

  useEffect(() => {
    if (!currentTrack?.id) {
      return;
    }

    const row = musicTrackRowRefs.current.get(currentTrack.id);
    row?.scrollIntoView?.({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentTrack?.id, musicTrackRowRefs]);

  const handleAddMusicTrack = useCallback(async () => {
    const nextValue = String(musicInput || "").trim();
    if (!nextValue || isAddingMusicTrack) {
      return;
    }

    setIsAddingMusicTrack(true);
    setMusicMessage("");

    try {
      const playlistId = extractYouTubePlaylistId(nextValue);
      if (playlistId) {
        const resolvedPlaylist = await resolveDirectorYouTubePlaylist(nextValue);
        const existingVideoIds = new Set(
          musicTracks.map((track) => track.videoId),
        );
        const nextTracksToAdd = resolvedPlaylist.tracks.filter(
          (track) => !existingVideoIds.has(track.videoId),
        );

        if (!nextTracksToAdd.length) {
          setMusicInput("");
          setMusicMessage("This playlist is already in the deck.");
          return;
        }

        const firstAddedTrack = nextTracksToAdd[0];
        const nextTrackIndex = musicTracks.length;
        setMusicTracks((current) => [...current, ...nextTracksToAdd]);
        setCurrentTrackIndex(nextTrackIndex);
        setMusicInput("");
        loadedMusicVideoIdRef.current = "";
        window.setTimeout(() => {
          syncMusicTrackToPlayer(firstAddedTrack, {
            autoplay: false,
            restart: true,
          });
        }, 0);
        void hydrateImportedMusicTracks(nextTracksToAdd);
        setMusicMessage(
          resolvedPlaylist.totalCount > resolvedPlaylist.importedCount
            ? `Playlist added. ${nextTracksToAdd.length} tracks loaded now.`
            : `Playlist added. ${nextTracksToAdd.length} tracks ready.`,
        );
        return;
      }

      const nextTrack = await resolveDirectorYouTubeTrack(nextValue);
      const existingIndex = musicTracks.findIndex(
        (track) => track.videoId === nextTrack.videoId,
      );

      if (existingIndex >= 0) {
        setCurrentTrackIndex(existingIndex);
        setMusicInput("");
        setMusicMessage("This video is already in the deck.");
        loadedMusicVideoIdRef.current = "";
        syncMusicTrackToPlayer(musicTracks[existingIndex], {
          autoplay: false,
          restart: true,
        });
        return;
      }

      setMusicTracks((current) => [...current, nextTrack]);
      setCurrentTrackIndex(musicTracks.length);
      setMusicInput("");
      loadedMusicVideoIdRef.current = "";
      window.setTimeout(() => {
        syncMusicTrackToPlayer(nextTrack, {
          autoplay: false,
          restart: true,
        });
      }, 0);
      setMusicMessage("Video added. Tap play.");
    } catch (caughtError) {
      setMusicMessage(caughtError.message || "Could not add this YouTube link.");
    } finally {
      setIsAddingMusicTrack(false);
    }
  }, [
    hydrateImportedMusicTracks,
    isAddingMusicTrack,
    loadedMusicVideoIdRef,
    musicInput,
    musicTracks,
    setCurrentTrackIndex,
    setMusicInput,
    setMusicMessage,
    setMusicTracks,
    syncMusicTrackToPlayer,
  ]);

  const handlePlayMusic = useCallback(async () => {
    const track = musicTracks[currentTrackIndex];
    if (!track) {
      return;
    }

    if (musicPlayerError) {
      setMusicPlayerError("");
      setMusicPlayerReady(false);
      setMusicMessage("Reloading YouTube player...");
      setMusicPlayerBootNonce((current) => current + 1);
      return;
    }

    if (!youtubePlayerRef.current) {
      setMusicPlayerReady(false);
      setMusicMessage("Loading YouTube player...");
      setMusicPlayerBootNonce((current) => current + 1);
      return;
    }

    const synced = syncMusicTrackToPlayer(track, {
      autoplay: true,
    });

    if (!synced) {
      setMusicMessage("YouTube player is loading...");
    }
  }, [
    currentTrackIndex,
    musicPlayerError,
    musicTracks,
    setMusicMessage,
    setMusicPlayerBootNonce,
    setMusicPlayerError,
    setMusicPlayerReady,
    syncMusicTrackToPlayer,
    youtubePlayerRef,
  ]);

  const handlePauseMusic = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (!player) {
      return;
    }

    try {
      player.pauseVideo();
      setMusicState("paused");
    } catch {
      setMusicMessage("Could not pause this video.");
    }
  }, [setMusicMessage, setMusicState, youtubePlayerRef]);

  const handleStopMusic = useCallback(() => {
    stopMusicDeck();
    setMusicMessage("Music stopped.");
  }, [setMusicMessage, stopMusicDeck]);

  const handleNextMusic = useCallback(async () => {
    if (!musicTracks.length) {
      return;
    }

    const nextIndex = (currentTrackIndex + 1) % musicTracks.length;
    const nextTrack = musicTracks[nextIndex];
    setCurrentTrackIndex(nextIndex);

    if (!nextTrack) {
      return;
    }

    const synced = syncMusicTrackToPlayer(nextTrack, {
      autoplay: true,
      restart: true,
    });

    if (!synced) {
      setMusicMessage("YouTube player is loading...");
    }
  }, [
    currentTrackIndex,
    musicTracks,
    setCurrentTrackIndex,
    setMusicMessage,
    syncMusicTrackToPlayer,
  ]);

  const handleToggleMusicPlayback = useCallback(() => {
    if (!musicTracks[currentTrackIndex]) {
      return;
    }

    if (musicState === "playing") {
      handlePauseMusic();
      return;
    }

    void handlePlayMusic();
  }, [
    currentTrackIndex,
    handlePauseMusic,
    handlePlayMusic,
    musicState,
    musicTracks,
  ]);

  const handleRemoveMusicTrack = useCallback(
    (trackId) => {
      const removeIndex = musicTracks.findIndex((track) => track.id === trackId);
      if (removeIndex < 0) {
        return;
      }

      const nextTracks = musicTracks.filter((track) => track.id !== trackId);
      setMusicTracks(nextTracks);

      if (!nextTracks.length) {
        loadedMusicVideoIdRef.current = "";
        stopMusicDeck();
        setCurrentTrackIndex(0);
        setMusicState("idle");
        setMusicMessage("Deck cleared.");
        return;
      }

      const nextIndex =
        currentTrackIndex > removeIndex
          ? currentTrackIndex - 1
          : Math.min(currentTrackIndex, nextTracks.length - 1);
      const nextTrack = nextTracks[nextIndex];
      setCurrentTrackIndex(nextIndex);
      loadedMusicVideoIdRef.current = "";
      if (nextTrack) {
        const autoplay = musicState === "playing";
        window.setTimeout(() => {
          syncMusicTrackToPlayer(nextTrack, { autoplay });
        }, 0);
      }
      setMusicMessage("Video removed.");
    },
    [
      currentTrackIndex,
      loadedMusicVideoIdRef,
      musicState,
      musicTracks,
      setCurrentTrackIndex,
      setMusicMessage,
      setMusicState,
      setMusicTracks,
      stopMusicDeck,
      syncMusicTrackToPlayer,
    ],
  );

  const handleSelectMusicTrack = useCallback(
    (index) => {
      const nextTrack = musicTracks[index];
      if (!nextTrack) {
        return;
      }

      setCurrentTrackIndex(index);
      loadedMusicVideoIdRef.current = "";
      syncMusicTrackToPlayer(nextTrack, {
        autoplay: musicState === "playing",
      });
    },
    [
      loadedMusicVideoIdRef,
      musicState,
      musicTracks,
      setCurrentTrackIndex,
      syncMusicTrackToPlayer,
    ],
  );

  const handleDirectorMicStart = useCallback(async () => {
    if (!directorSpeakerOn || directorMicHoldingRef.current) {
      return;
    }

    directorMicHoldingRef.current = true;
    setDirectorHoldLive(true);
    playUiTone({ frequency: 900, durationMs: 100, type: "sine", volume: 0.04 });
    const started = micMonitor.isPaused
      ? await micMonitor.resume({ pauseMedia: true })
      : micMonitor.isActive
        ? true
        : await micMonitor.start({
            pauseMedia: true,
            startPaused: false,
            playStartCue: false,
          });
    if (!started) {
      directorMicHoldingRef.current = false;
      setDirectorHoldLive(false);
    }
  }, [
    directorMicHoldingRef,
    directorSpeakerOn,
    micMonitor,
    setDirectorHoldLive,
  ]);

  const handleDirectorMicStop = useCallback(async () => {
    directorMicHoldingRef.current = false;
    setDirectorHoldLive(false);
    if (micMonitor.isActive && !micMonitor.isPaused) {
      await micMonitor.pause({ resumeMedia: true });
      return;
    }

    await micMonitor.stop({ resumeMedia: true });
  }, [directorMicHoldingRef, micMonitor, setDirectorHoldLive]);

  const handleDirectorSpeakerSwitchChange = useCallback(
    async (nextChecked) => {
      setDirectorSpeakerOn(nextChecked);

      if (nextChecked) {
        const prepared = await micMonitor.prepare({ requestPermission: true });
        if (!prepared) {
          setDirectorSpeakerOn(false);
          return;
        }

        if (!micMonitor.isActive && !micMonitor.isPaused) {
          const primed = await micMonitor.start({
            pauseMedia: false,
            startPaused: true,
            playStartCue: false,
          });
          if (!primed) {
            setDirectorSpeakerOn(false);
          }
        }
        return;
      }

      directorMicPointerIdRef.current = null;
      directorMicHoldingRef.current = false;
      setDirectorHoldLive(false);
      await micMonitor.stop({ resumeMedia: true });
    },
    [
      directorMicHoldingRef,
      directorMicPointerIdRef,
      micMonitor,
      setDirectorHoldLive,
      setDirectorSpeakerOn,
    ],
  );

  useEffect(() => {
    const handlePointerRelease = (event) => {
      if (
        directorMicPointerIdRef.current !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== directorMicPointerIdRef.current
      ) {
        return;
      }

      directorMicPointerIdRef.current = null;
      void handleDirectorMicStop();
    };

    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [directorMicPointerIdRef, handleDirectorMicStop]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const resetHeldAudio = () => {
      directorMicPointerIdRef.current = null;
      void handleDirectorMicStop();
      void walkie.stopTalking("backgrounded");
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        resetHeldAudio();
      }
    };

    window.addEventListener("pagehide", resetHeldAudio);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", resetHeldAudio);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [directorMicPointerIdRef, handleDirectorMicStop, walkie]);

  useEffect(() => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setSpeakerMessage("Uses your phone or browser output.");
      return;
    }

    let cancelled = false;
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) {
          return;
        }

        const outputs = devices.filter(
          (device) => device.kind === "audiooutput",
        );
        if (outputs.length) {
          setSpeakerMessage(
            typeof HTMLMediaElement !== "undefined" &&
              "setSinkId" in HTMLMediaElement.prototype
              ? "Speaker selection is supported in this browser."
              : "Using your phone or Bluetooth output.",
          );
        } else {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpeakerMessage("Using your phone or Bluetooth output.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setSpeakerMessage]);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      typeof MediaMetadata === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    if (iOSSafari || !currentTrack || musicState !== "playing") {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // Ignore unsupported action cleanup.
      }
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: "YouTube deck",
      album: "GV Cricket Music Deck",
    });
    navigator.mediaSession.playbackState =
      musicState === "playing" ? "playing" : "paused";

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        void handlePlayMusic();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        handlePauseMusic();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (musicTracks.length > 1) {
          void handleNextMusic();
        }
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        handleStopMusic();
      });
    } catch {
      // Some browsers only support a subset of media session actions.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // Ignore unsupported action cleanup.
      }
    };
  }, [
    currentTrack,
    handleNextMusic,
    handlePauseMusic,
    handlePlayMusic,
    handleStopMusic,
    iOSSafari,
    musicState,
    musicTracks.length,
  ]);

  return {
    audioRef,
    currentTrack,
    currentTrackIndex,
    directorAudioMode,
    directorMicLive,
    directorMicPointerIdRef,
    directorSpeakerOn,
    handleAddMusicTrack,
    handleDirectorMicStart,
    handleDirectorMicStop,
    handleDirectorSpeakerSwitchChange,
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
  };
}


