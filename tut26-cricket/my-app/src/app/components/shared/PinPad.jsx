"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: PinPad.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { FaBackspace } from "react-icons/fa";

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"];

export default function PinPad({
  value,
  onChange,
  onSubmit,
  length = 4,
  submitLabel = "Enter",
  isSubmitting = false,
  disabled = false,
  submitDisabled = false,
}) {
  const appendDigit = (digit) => {
    if (disabled || isSubmitting || value.length >= length) {
      return;
    }

    onChange(`${value}${digit}`);
  };

  const removeDigit = () => {
    if (disabled || isSubmitting || !value.length) {
      return;
    }

    onChange(value.slice(0, -1));
  };

  const clearDigits = () => {
    if (disabled || isSubmitting || !value.length) {
      return;
    }

    onChange("");
  };

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-4 gap-2 rounded-2xl bg-zinc-800/80 p-3 ring-1 ring-zinc-700"
        aria-label={`${length} digit PIN`}
      >
        {Array.from({ length }).map((_, index) => (
          <div
            key={index}
            className="flex h-12 items-center justify-center rounded-xl bg-zinc-900 text-xl text-white"
          >
            <span aria-hidden="true">{index < value.length ? "•" : "–"}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PAD_KEYS.map((key) => {
          if (key === "clear") {
            return (
              <button
                key={key}
                type="button"
                onClick={clearDigits}
                disabled={disabled || isSubmitting || !value.length}
                className="h-14 rounded-2xl bg-zinc-800 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-40"
                aria-label="Clear PIN"
              >
                Clear
              </button>
            );
          }

          if (key === "delete") {
            return (
              <button
                key={key}
                type="button"
                onClick={removeDigit}
                disabled={disabled || isSubmitting || !value.length}
                className="flex h-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-40"
                aria-label="Delete digit"
              >
                <FaBackspace />
              </button>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => appendDigit(key)}
              disabled={disabled || isSubmitting || value.length >= length}
              className="h-14 rounded-2xl bg-zinc-800 text-lg font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40"
              aria-label={`Digit ${key}`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSubmit?.(value)}
        disabled={disabled || submitDisabled || isSubmitting || value.length !== length}
        className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {isSubmitting ? "Checking..." : submitLabel}
      </button>
    </div>
  );
}


