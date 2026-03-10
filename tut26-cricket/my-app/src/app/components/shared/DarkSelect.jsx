"use client";

import { useEffect, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";

export default function DarkSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select",
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedOption =
    options.find((option) => option.value === value) || options[0] || null;

  const toggleOpen = () => {
    if (!open && rootRef.current && typeof window !== "undefined") {
      const rect = rootRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const estimatedMenuHeight = Math.min(options.length * 54 + 16, 280);
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      setOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow);
    }

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
        className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-left text-sm text-white outline-none transition hover:bg-white/[0.06] focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20"
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <FaChevronDown
          className={`shrink-0 text-xs text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/98 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl ${
            openUpward ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
          }`}
        >
          <div className="max-h-[280px] overflow-y-auto">
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
        </div>
      ) : null}
    </div>
  );
}
