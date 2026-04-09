/**
 * File overview:
 * Purpose: Encapsulates Director browser state, effects, and runtime coordination.
 * Main exports: useDirectorAudioLibrary.
 * Major callers: Feature routes and sibling components.
 * Side effects: reads or writes browser storage.
 * Read next: ./README.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIRECTOR_AUDIO_METADATA_CACHE_KEY,
  DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS,
  findLibraryCardIdFromPoint,
  readCachedDirectorAudioLibrary,
  serializeOrder,
  writeCachedDirectorAudioLibrary,
} from "../director-console-utils";
import {
  filterSoundEffectsByQuery,
  readCachedSoundEffectsOrder as readSharedSoundEffectsOrder,
  subscribeSoundEffectsLibrarySync,
  writeCachedSoundEffectsOrder as writeSharedSoundEffectsOrder,
} from "../../../../lib/sound-effects-client";
import { isUiAudioUnlocked } from "../../../../lib/page-audio";

let directorAudioLibraryPromise = null;
let directorAudioMetadataMemoryCache = {};

export default function useDirectorAudioLibrary({ usePointerLibraryReorder }) {
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryOrder, setLibraryOrder] = useState([]);
  const [libraryDurations, setLibraryDurations] = useState({});
  const [libraryCurrentTime, setLibraryCurrentTime] = useState(0);
  const [libraryLiveId, setLibraryLiveId] = useState("");
  const [libraryState, setLibraryState] = useState("idle");
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(true);
  const [effectsNeedsUnlock, setEffectsNeedsUnlock] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(() => isUiAudioUnlocked());
  const [draggingLibraryId, setDraggingLibraryId] = useState("");
  const [libraryDropTargetId, setLibraryDropTargetId] = useState("");

  const pendingLibraryOrderRef = useRef(null);
  const libraryOrderSaveTimerRef = useRef(null);
  const lastPersistedLibraryOrderRef = useRef(serializeOrder([]));
  const effectsAudioRef = useRef(null);
  const bufferedEffectPlaybackRef = useRef(null);
  const bufferedEffectTimerRef = useRef(null);
  const effectPlayRequestRef = useRef(0);
  const effectPrimeRequestRef = useRef(null);
  const cachedEffectUrlRef = useRef(new Map());
  const libraryPointerDragRef = useRef({
    pointerId: null,
    activeId: "",
    targetId: "",
  });
  const libraryLoadTimeoutRef = useRef(null);

  const syncLibraryStateFromCache = useCallback(() => {
    const nextFiles = readCachedDirectorAudioLibrary();
    const nextOrder = readSharedSoundEffectsOrder();
    setLibraryFiles(nextFiles);
    setLibraryOrder(nextOrder);
    lastPersistedLibraryOrderRef.current = serializeOrder(nextOrder);
    if (
      pendingLibraryOrderRef.current &&
      serializeOrder(pendingLibraryOrderRef.current) ===
        lastPersistedLibraryOrderRef.current
    ) {
      pendingLibraryOrderRef.current = null;
    }
  }, []);

  const fetchAudioLibrary = useCallback(async ({ force = false } = {}) => {
    if (directorAudioLibraryPromise) {
      const nextFiles = await directorAudioLibraryPromise;
      setLibraryFiles(nextFiles);
      return nextFiles;
    }

    directorAudioLibraryPromise = (async () => {
      const response = await fetch("/api/director/audio-library", {
        cache: force ? "no-store" : "default",
      });
      const payload = await response
        .json()
        .catch(() => ({ files: [], order: [] }));

      if (!response.ok) {
        return [];
      }

      const nextFiles = Array.isArray(payload.files) ? payload.files : [];
      const nextOrder = Array.isArray(payload.order) ? payload.order : [];
      setLibraryOrder(nextOrder);
      lastPersistedLibraryOrderRef.current = serializeOrder(nextOrder);
      if (
        pendingLibraryOrderRef.current &&
        serializeOrder(pendingLibraryOrderRef.current) ===
          lastPersistedLibraryOrderRef.current
      ) {
        pendingLibraryOrderRef.current = null;
      }
      writeSharedSoundEffectsOrder(nextOrder);
      writeCachedDirectorAudioLibrary(nextFiles);
      return nextFiles;
    })();

    try {
      const nextFiles = await directorAudioLibraryPromise;
      setLibraryFiles(nextFiles);
      return nextFiles;
    } finally {
      directorAudioLibraryPromise = null;
    }
  }, []);

  useEffect(() => {
    const cachedFiles = readCachedDirectorAudioLibrary();
    if (cachedFiles.length) {
      setLibraryFiles(cachedFiles);
    }
  }, []);

  useEffect(() => {
    return subscribeSoundEffectsLibrarySync(() => {
      syncLibraryStateFromCache();
    });
  }, [syncLibraryStateFromCache]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const cachedValue = window.sessionStorage.getItem(
        DIRECTOR_AUDIO_METADATA_CACHE_KEY,
      );
      if (!cachedValue) {
        return;
      }
      const parsed = JSON.parse(cachedValue);
      if (parsed && typeof parsed === "object") {
        directorAudioMetadataMemoryCache = parsed;
        setLibraryDurations(parsed);
      }
    } catch {
      // Ignore broken cache.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setLibraryOrder(readSharedSoundEffectsOrder());
    } catch {
      setLibraryOrder([]);
    }
  }, []);

  const orderedLibraryFiles = useMemo(() => {
    if (!libraryFiles.length) {
      return [];
    }

    if (!libraryOrder.length) {
      return libraryFiles;
    }

    const orderMap = new Map(libraryOrder.map((id, index) => [id, index]));
    return [...libraryFiles].sort((left, right) => {
      const leftIndex = orderMap.has(left.id)
        ? orderMap.get(left.id)
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.has(right.id)
        ? orderMap.get(right.id)
        : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      const leftDuration = libraryDurations[left.id] || 0;
      const rightDuration = libraryDurations[right.id] || 0;
      if (leftDuration !== rightDuration) {
        return rightDuration - leftDuration;
      }
      return left.label.localeCompare(right.label);
    });
  }, [libraryDurations, libraryFiles, libraryOrder]);

  const filteredLibraryFiles = useMemo(
    () => filterSoundEffectsByQuery(orderedLibraryFiles, librarySearchQuery),
    [librarySearchQuery, orderedLibraryFiles],
  );

  const clearLibraryOrderSaveTimer = useCallback(() => {
    if (libraryOrderSaveTimerRef.current) {
      window.clearTimeout(libraryOrderSaveTimerRef.current);
      libraryOrderSaveTimerRef.current = null;
    }
  }, []);

  const persistLibraryOrder = useCallback(
    async (nextOrder, { keepalive = false } = {}) => {
      try {
        const response = await fetch("/api/director/audio-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive,
          body: JSON.stringify({ order: nextOrder }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const flushPendingLibraryOrder = useCallback(
    async ({ useBeacon = false } = {}) => {
      const nextOrder = pendingLibraryOrderRef.current;
      if (!nextOrder?.length) {
        return false;
      }

      const serializedOrder = serializeOrder(nextOrder);
      if (serializedOrder === lastPersistedLibraryOrderRef.current) {
        pendingLibraryOrderRef.current = null;
        return true;
      }

      if (
        useBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        try {
          const payload = new Blob([JSON.stringify({ order: nextOrder })], {
            type: "application/json",
          });
          const queued = navigator.sendBeacon(
            "/api/director/audio-library",
            payload,
          );
          if (queued) {
            lastPersistedLibraryOrderRef.current = serializedOrder;
            pendingLibraryOrderRef.current = null;
            return true;
          }
        } catch {
          // Fall through to fetch keepalive.
        }
      }

      const persisted = await persistLibraryOrder(nextOrder, {
        keepalive: useBeacon,
      });
      if (persisted) {
        lastPersistedLibraryOrderRef.current = serializedOrder;
        pendingLibraryOrderRef.current = null;
      }
      return persisted;
    },
    [persistLibraryOrder],
  );

  const scheduleLibraryOrderPersist = useCallback(
    (nextOrder) => {
      const serializedOrder = serializeOrder(nextOrder);
      pendingLibraryOrderRef.current = nextOrder;

      clearLibraryOrderSaveTimer();

      if (serializedOrder === lastPersistedLibraryOrderRef.current) {
        pendingLibraryOrderRef.current = null;
        return;
      }

      libraryOrderSaveTimerRef.current = window.setTimeout(() => {
        libraryOrderSaveTimerRef.current = null;
        void flushPendingLibraryOrder();
      }, DIRECTOR_AUDIO_ORDER_SAVE_DELAY_MS);
    },
    [clearLibraryOrderSaveTimer, flushPendingLibraryOrder],
  );

  const handleLibraryReorder = useCallback(
    (nextFiles) => {
      setLibraryFiles(nextFiles);
      const nextOrder = nextFiles.map((file) => file.id);
      setLibraryOrder(nextOrder);
      writeSharedSoundEffectsOrder(nextOrder);
      scheduleLibraryOrderPersist(nextOrder);
    },
    [scheduleLibraryOrderPersist],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const flushQueuedOrder = () => {
      clearLibraryOrderSaveTimer();
      void flushPendingLibraryOrder({ useBeacon: true });
    };

    window.addEventListener("pagehide", flushQueuedOrder);
    window.addEventListener("beforeunload", flushQueuedOrder);

    return () => {
      window.removeEventListener("pagehide", flushQueuedOrder);
      window.removeEventListener("beforeunload", flushQueuedOrder);
    };
  }, [clearLibraryOrderSaveTimer, flushPendingLibraryOrder]);

  const moveLibraryItem = useCallback(
    (activeId, targetId) => {
      if (!activeId || !targetId || activeId === targetId) {
        return;
      }

      const activeIndex = orderedLibraryFiles.findIndex(
        (file) => file.id === activeId,
      );
      const targetIndex = orderedLibraryFiles.findIndex(
        (file) => file.id === targetId,
      );

      if (activeIndex < 0 || targetIndex < 0) {
        return;
      }

      const nextFiles = [...orderedLibraryFiles];
      const [movedItem] = nextFiles.splice(activeIndex, 1);
      nextFiles.splice(targetIndex, 0, movedItem);
      handleLibraryReorder(nextFiles);
    },
    [handleLibraryReorder, orderedLibraryFiles],
  );

  const setLibrarySelectionLock = useCallback((locked) => {
    if (typeof document === "undefined") {
      return;
    }

    [document.body, document.documentElement].forEach((node) => {
      if (!node) {
        return;
      }

      if (locked) {
        node.style.setProperty("user-select", "none");
        node.style.setProperty("-webkit-user-select", "none");
        node.style.setProperty("-webkit-touch-callout", "none");
      } else {
        node.style.removeProperty("user-select");
        node.style.removeProperty("-webkit-user-select");
        node.style.removeProperty("-webkit-touch-callout");
      }
    });
  }, []);

  useEffect(
    () => () => {
      setLibrarySelectionLock(false);
    },
    [setLibrarySelectionLock],
  );

  const updatePointerLibraryDropTarget = useCallback((clientX, clientY) => {
    const activeId = libraryPointerDragRef.current.activeId;
    if (!activeId) {
      return;
    }

    const hoveredId = findLibraryCardIdFromPoint(clientX, clientY);
    const nextTargetId = hoveredId && hoveredId !== activeId ? hoveredId : "";

    if (libraryPointerDragRef.current.targetId === nextTargetId) {
      return;
    }

    libraryPointerDragRef.current.targetId = nextTargetId;
    setLibraryDropTargetId(nextTargetId);
  }, []);

  const clearLibraryDragState = useCallback(() => {
    libraryPointerDragRef.current = {
      pointerId: null,
      activeId: "",
      targetId: "",
    };
    setLibrarySelectionLock(false);
    setDraggingLibraryId("");
    setLibraryDropTargetId("");
  }, [setLibrarySelectionLock]);

  const finishPointerLibraryDrag = useCallback(
    (pointerId = null, options = {}) => {
      const { commit = true, clientX = null, clientY = null } = options;
      const activeDrag = libraryPointerDragRef.current;

      if (!activeDrag.activeId) {
        return;
      }

      if (
        pointerId !== null &&
        activeDrag.pointerId !== null &&
        pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        updatePointerLibraryDropTarget(clientX, clientY);
      }

      const activeId = libraryPointerDragRef.current.activeId;
      const targetId = libraryPointerDragRef.current.targetId;
      clearLibraryDragState();

      if (commit && activeId && targetId && activeId !== targetId) {
        moveLibraryItem(activeId, targetId);
      }
    },
    [clearLibraryDragState, moveLibraryItem, updatePointerLibraryDropTarget],
  );

  const handleLibraryGripPointerDown = useCallback(
    (event, fileId) => {
      if (!usePointerLibraryReorder) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setLibrarySelectionLock(true);
      libraryPointerDragRef.current = {
        pointerId: event.pointerId ?? null,
        activeId: fileId,
        targetId: "",
      };
      setDraggingLibraryId(fileId);
      setLibraryDropTargetId("");
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [setLibrarySelectionLock, usePointerLibraryReorder],
  );

  const handleLibraryDragStart = (event, fileId) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    setDraggingLibraryId(fileId);
    setLibraryDropTargetId("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fileId);
  };

  const handleLibraryDragEnter = (fileId) => {
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDragOver = (event, fileId) => {
    event.preventDefault();
    if (draggingLibraryId && draggingLibraryId !== fileId) {
      event.dataTransfer.dropEffect = "move";
      setLibraryDropTargetId(fileId);
    }
  };

  const handleLibraryDrop = (event, fileId) => {
    event.preventDefault();
    const activeId =
      event.dataTransfer.getData("text/plain") || draggingLibraryId;
    moveLibraryItem(activeId, fileId);
    clearLibraryDragState();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const activeDrag = libraryPointerDragRef.current;
      if (!activeDrag.activeId) {
        return;
      }

      if (
        activeDrag.pointerId !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== activeDrag.pointerId
      ) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      updatePointerLibraryDropTarget(event.clientX, event.clientY);
    };

    const handlePointerRelease = (event) => {
      finishPointerLibraryDrag(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handlePointerCancel = (event) => {
      finishPointerLibraryDrag(event.pointerId, { commit: false });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [finishPointerLibraryDrag, updatePointerLibraryDropTarget]);

  return {
    audioUnlocked,
    bufferedEffectPlaybackRef,
    bufferedEffectTimerRef,
    cachedEffectUrlRef,
    clearLibraryDragState,
    clearLibraryOrderSaveTimer,
    draggingLibraryId,
    effectPlayRequestRef,
    effectPrimeRequestRef,
    effectsAudioRef,
    effectsNeedsUnlock,
    fetchAudioLibrary,
    filteredLibraryFiles,
    flushPendingLibraryOrder,
    handleLibraryDragEnter,
    handleLibraryDragOver,
    handleLibraryDragStart,
    handleLibraryDrop,
    handleLibraryGripPointerDown,
    libraryCurrentTime,
    libraryDropTargetId,
    libraryDurations,
    libraryFiles,
    libraryLiveId,
    libraryLoadTimeoutRef,
    libraryPanelOpen,
    librarySearchQuery,
    libraryState,
    orderedLibraryFiles,
    setAudioUnlocked,
    setEffectsNeedsUnlock,
    setLibraryCurrentTime,
    setLibraryDurations,
    setLibraryLiveId,
    setLibraryPanelOpen,
    setLibrarySearchQuery,
    setLibraryState,
    usePointerLibraryReorder,
  };
}


