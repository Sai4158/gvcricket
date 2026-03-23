"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaChevronDown,
  FaGripVertical,
  FaMusic,
  FaPause,
  FaPlay,
  FaVolumeUp,
} from "react-icons/fa";

function formatAudioTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const wholeSeconds = Math.max(0, Math.round(safeSeconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function MatchSoundEffectsPanel({
  files,
  isDisabled = false,
  isLoading = false,
  isOpen = false,
  error = "",
  activeEffectId = "",
  activeEffectStatus = "idle",
  activeEffectCurrentTime = 0,
  effectDurations = {},
  onToggle,
  onMinimize,
  onPlayEffect,
  onStopEffect,
  onReorder,
  needsUnlock = false,
}) {
  const effectCount = Array.isArray(files) ? files.length : 0;
  const [draggingId, setDraggingId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const pointerDragRef = useRef({
    pointerId: null,
    activeId: "",
    targetId: "",
  });
  const usePointerReorder = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(
      window.matchMedia?.("(pointer: coarse)")?.matches ||
        window.navigator?.maxTouchPoints > 0,
    );
  }, []);

  const setSelectionLock = useCallback((locked) => {
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

  const findCardIdFromPoint = useCallback((clientX, clientY) => {
    if (typeof document === "undefined") {
      return "";
    }

    const target = document.elementFromPoint(clientX, clientY);
    const card = target instanceof HTMLElement
      ? target.closest("[data-sound-effect-id]")
      : null;
    return card?.getAttribute("data-sound-effect-id") || "";
  }, []);

  const clearDragState = useCallback(() => {
    pointerDragRef.current = {
      pointerId: null,
      activeId: "",
      targetId: "",
    };
    setSelectionLock(false);
    setDraggingId("");
    setDropTargetId("");
  }, [setSelectionLock]);

  const updatePointerDropTarget = useCallback((clientX, clientY) => {
    const activeId = pointerDragRef.current.activeId;
    if (!activeId) {
      return;
    }

    const hoveredId = findCardIdFromPoint(clientX, clientY);
    const nextTargetId =
      hoveredId && hoveredId !== activeId ? hoveredId : "";

    if (pointerDragRef.current.targetId === nextTargetId) {
      return;
    }

    pointerDragRef.current.targetId = nextTargetId;
    setDropTargetId(nextTargetId);
  }, [findCardIdFromPoint]);

  const finishPointerDrag = useCallback((pointerId = null, options = {}) => {
    const { commit = true, clientX = null, clientY = null } = options;
    const activeDrag = pointerDragRef.current;

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
      updatePointerDropTarget(clientX, clientY);
    }

    const activeId = pointerDragRef.current.activeId;
    const targetId = pointerDragRef.current.targetId;
    clearDragState();

    if (commit && activeId && targetId && activeId !== targetId) {
      onReorder?.(activeId, targetId);
    }
  }, [clearDragState, onReorder, updatePointerDropTarget]);

  const handleGripPointerDown = useCallback((event, fileId) => {
    if (!usePointerReorder) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectionLock(true);
    pointerDragRef.current = {
      pointerId: event.pointerId ?? null,
      activeId: fileId,
      targetId: "",
    };
    setDraggingId(fileId);
    setDropTargetId("");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [setSelectionLock, usePointerReorder]);

  const handleDragStart = useCallback((event, fileId) => {
    setDraggingId(fileId);
    setDropTargetId("");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fileId);
  }, []);

  const handleDragEnter = useCallback((fileId) => {
    if (draggingId && draggingId !== fileId) {
      setDropTargetId(fileId);
    }
  }, [draggingId]);

  const handleDragOver = useCallback((event, fileId) => {
    event.preventDefault();
    if (draggingId && draggingId !== fileId) {
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(fileId);
    }
  }, [draggingId]);

  const handleDrop = useCallback((event, fileId) => {
    event.preventDefault();
    const activeId =
      event.dataTransfer.getData("text/plain") || draggingId;
    if (activeId && activeId !== fileId) {
      onReorder?.(activeId, fileId);
    }
    clearDragState();
  }, [clearDragState, draggingId, onReorder]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const activeDrag = pointerDragRef.current;
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
      updatePointerDropTarget(event.clientX, event.clientY);
    };

    const handlePointerRelease = (event) => {
      finishPointerDrag(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
    };
  }, [finishPointerDrag, updatePointerDropTarget]);

  useEffect(() => () => {
    clearDragState();
  }, [clearDragState]);

  const handleEffectTap = useCallback((file, isActive) => {
    if (isDisabled) {
      return;
    }

    if (isActive) {
      onStopEffect?.();
      return;
    }

    void onPlayEffect?.(file);
  }, [isDisabled, onPlayEffect, onStopEffect]);

  return (
    <section
      className={`relative mt-6 overflow-hidden rounded-[30px] border px-4 py-4 transition ${
        isOpen
          ? "border-amber-300/16 bg-[linear-gradient(180deg,rgba(20,20,26,0.98),rgba(7,8,12,0.99))] shadow-[0_24px_80px_rgba(0,0,0,0.42),0_0_0_1px_rgba(251,191,36,0.03)]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(19,19,24,0.96),rgba(8,8,12,0.98))] shadow-[0_20px_70px_rgba(0,0,0,0.35)]"
      }`}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 via-35% via-cyan-200/45 to-transparent" />
      <span className="pointer-events-none absolute -left-10 top-3 h-28 w-28 rounded-full bg-amber-400/10 blur-3xl" />
      <span className="pointer-events-none absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-cyan-400/8 blur-3xl" />
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[24px] border px-4 py-3 text-left transition ${
          isOpen
            ? "border-amber-300/16 bg-[linear-gradient(180deg,rgba(29,22,14,0.58),rgba(16,18,28,0.72))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_44px_rgba(0,0,0,0.24)]"
            : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]"
        }`}
        aria-expanded={isOpen}
        aria-label="Toggle sound effects"
      >
        <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(251,191,36,0.28),rgba(146,64,14,0.08))] text-amber-100 shadow-[0_10px_26px_rgba(245,158,11,0.2)]">
            <span className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_55%)]" />
            <FaVolumeUp />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.22em] text-white">
              Sound Effects
            </span>
            <span className="mt-1 block text-[11px] font-medium tracking-[0.14em] text-zinc-400">
              {isLoading
                ? "Loading..."
                : effectCount
                  ? `${effectCount} ready to tap`
                  : "Tap to load"}
            </span>
          </span>
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.045] text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <FaChevronDown
            className={`text-sm transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-3">
          {needsUnlock ? (
            <div className="rounded-[22px] border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Tap a sound once to enable audio on this phone.
            </div>
          ) : null}
          {error ? (
            <div className="rounded-[22px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
              Loading sound effects...
            </div>
          ) : effectCount ? (
            <div className="grid grid-cols-2 gap-3">
              {files.map((file) => {
                const isActive = activeEffectId === file.id;
                const effectDuration = Number(effectDurations[file.id] || 0);
                const effectCurrentTime = isActive
                  ? Math.min(
                      effectDuration > 0 ? effectDuration : activeEffectCurrentTime,
                      Math.max(0, Number(activeEffectCurrentTime || 0)),
                    )
                  : 0;
                const statusText = isActive
                  ? activeEffectStatus === "loading"
                    ? "Loading..."
                    : "Tap to pause"
                  : "Tap to play";
                return (
                  <div
                    key={file.id}
                    data-sound-effect-id={file.id}
                    draggable={!usePointerReorder}
                    onDragStart={(event) => handleDragStart(event, file.id)}
                    onDragEnter={() => handleDragEnter(file.id)}
                    onDragOver={(event) => handleDragOver(event, file.id)}
                    onDrop={(event) => handleDrop(event, file.id)}
                    onDragEnd={clearDragState}
                    onClick={() => handleEffectTap(file, isActive)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && !isDisabled) {
                        event.preventDefault();
                        handleEffectTap(file, isActive);
                      }
                    }}
                    className={`rounded-[24px] border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-emerald-300/30 bg-[linear-gradient(180deg,rgba(18,40,34,0.92),rgba(10,16,18,0.96))] shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
                    } ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : "hover:-translate-y-0.5 hover:border-white/15"
                    } ${
                      draggingId === file.id
                        ? "scale-[0.985] opacity-75 shadow-[0_20px_50px_rgba(0,0,0,0.34)]"
                        : ""
                    } ${
                      dropTargetId === file.id
                        ? "border-emerald-300/40 ring-2 ring-emerald-400/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/90">
                        <FaMusic className="text-sm" />
                      </span>
                      <div className="flex items-start gap-2">
                        {isActive ? (
                          <span className="rounded-full border border-emerald-300/20 bg-emerald-500/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                            Live
                          </span>
                        ) : null}
                        <span
                          role="button"
                          tabIndex={-1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400"
                          title={
                            usePointerReorder
                              ? "Drag this handle to reorder"
                              : "Drag to reorder"
                          }
                          onPointerDown={(event) => handleGripPointerDown(event, file.id)}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onDragStart={(event) => {
                            if (usePointerReorder) {
                              event.preventDefault();
                            }
                          }}
                          style={{
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            WebkitTouchCallout: "none",
                            touchAction: usePointerReorder ? "none" : "auto",
                          }}
                        >
                          <FaGripVertical className="text-sm" />
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                        {file.label}
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div className="space-y-1 text-xs text-zinc-400">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                            {statusText}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {`${formatAudioTime(effectCurrentTime)} / ${formatAudioTime(
                              effectDuration,
                            )}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleEffectTap(file, isActive);
                          }}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition ${
                            isActive
                              ? "border-emerald-300/20 bg-emerald-500/12"
                              : "border-white/10 bg-white/8"
                          }`}
                          aria-label={`${isActive ? "Pause" : "Play"} ${file.label}`}
                        >
                          {isActive ? (
                            activeEffectStatus === "loading" ? (
                              <FaMusic className="text-xs" />
                            ) : (
                              <FaPause className="text-xs" />
                            )
                          ) : (
                            <FaPlay className="translate-x-[1px] text-xs" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
              No sound effects found yet.
            </div>
          )}
          <button
            type="button"
            onClick={onMinimize || onToggle}
            className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/[0.07]"
          >
            Minimize
          </button>
        </div>
      ) : null}
    </section>
  );
}
