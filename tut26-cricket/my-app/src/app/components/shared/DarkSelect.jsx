"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown } from "react-icons/fa";

export default function DarkSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select",
  leadingIcon: LeadingIcon = null,
  leadingLabel = "",
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const positionFrameRef = useRef(0);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedOption =
    options.find((option) => option.value === value) || options[0] || null;

  const updateMenuPosition = useCallback(() => {
    if (!rootRef.current || typeof window === "undefined") {
      return;
    }

    const rect = rootRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const estimatedMenuHeight = Math.min(options.length * 54 + 16, 280);
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 12);
    const spaceAbove = Math.max(0, rect.top - 12);
    const shouldOpenUpward =
      spaceBelow < Math.min(estimatedMenuHeight, 220) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      140,
      Math.min(280, shouldOpenUpward ? spaceAbove : spaceBelow, viewportHeight - 24)
    );
    const width = Math.min(rect.width, viewportWidth - 16);
    const left = Math.min(Math.max(8, rect.left), viewportWidth - width - 8);

    setMenuStyle({
      left,
      top: shouldOpenUpward
        ? Math.max(8, rect.top - maxHeight - 8)
        : Math.min(viewportHeight - maxHeight - 8, rect.bottom + 8),
      width,
      maxHeight,
    });
  }, [options.length]);

  const scheduleMenuPosition = useCallback(() => {
    if (positionFrameRef.current || typeof window === "undefined") {
      return;
    }

    positionFrameRef.current = window.requestAnimationFrame(() => {
      positionFrameRef.current = 0;
      updateMenuPosition();
    });
  }, [updateMenuPosition]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    scheduleMenuPosition();

    const handleWindowChange = () => {
      scheduleMenuPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, {
      capture: true,
      passive: true,
    });

    return () => {
      if (positionFrameRef.current) {
        window.cancelAnimationFrame(positionFrameRef.current);
        positionFrameRef.current = 0;
      }
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open, scheduleMenuPosition]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const toggleOpen = () => {
    setOpen((current) => !current);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.04] text-left text-sm text-white outline-none transition hover:bg-white/[0.06] focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20 ${
          compact ? "px-4 py-3" : "px-4 py-3.5"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {LeadingIcon ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] text-zinc-300">
              <LeadingIcon className="text-[12px]" />
            </span>
          ) : null}
          <span className="min-w-0">
            {leadingLabel ? (
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {leadingLabel}
              </span>
            ) : null}
            <span className="block truncate">{selectedOption?.label || placeholder}</span>
          </span>
        </span>
        <FaChevronDown
          className={`shrink-0 text-xs text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {typeof document !== "undefined" && open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[80] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/98 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl"
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                width: menuStyle.width,
              }}
            >
              <div
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: menuStyle.maxHeight }}
              >
                {options.map((option) => {
                  const selected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange?.(option.value);
                        setOpen(false);
                      }}
                      className={`block w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                        selected
                          ? "bg-emerald-500/14 text-emerald-200"
                          : "text-zinc-200 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="block truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
