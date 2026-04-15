"use client";

/**
 * File overview:
 * Purpose: Renders Shared UI for the app's screens and flows.
 * Main exports: StepFlow.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

const STEPS = [
  { number: 1, label: "Session", compactLabel: "SES" },
  { number: 2, label: "Teams", compactLabel: "TEAM" },
  { number: 3, label: "Toss", compactLabel: "TOSS" },
  { number: 4, label: "Start", compactLabel: "START" },
];

export default function StepFlow({ currentStep = 1, className = "", compact = false }) {
  return (
    <div className={className}>
      <div
        className={`flex items-center justify-center ${
          compact ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3"
        }`}
      >
        {STEPS.map((step, index) => {
          const isDone = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <div
              key={step.number}
              className={`min-w-0 flex items-center ${
                compact ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3"
              }`}
            >
              <div className={`min-w-0 flex flex-col items-center text-center ${compact ? "gap-1" : "gap-1.5"}`}>
                <span
                  className={`inline-flex items-center justify-center rounded-full border font-semibold transition ${
                    compact
                      ? "h-7 min-w-7 px-1.5 text-[11px] sm:h-8 sm:min-w-8 sm:px-2 sm:text-xs"
                      : "h-8 min-w-8 px-2 text-xs"
                  } ${
                    isCurrent
                      ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
                      : isDone
                      ? "border-emerald-400/20 bg-emerald-400/12 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-zinc-500"
                  }`}
                >
                  {step.number}
                </span>
                <span
                  className={`whitespace-nowrap font-medium uppercase ${
                    compact
                      ? "text-[9px] tracking-[0.11em] sm:text-[10px] sm:tracking-[0.18em]"
                      : "text-[10px] tracking-[0.18em]"
                  } ${
                    isCurrent
                      ? "text-zinc-200"
                      : isDone
                      ? "text-emerald-200/85"
                      : "text-zinc-500"
                  }`}
                >
                  {compact ? (
                    <>
                      <span className="sm:hidden">{step.compactLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </>
                  ) : (
                    step.label
                  )}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  className={`block h-[2px] rounded-full ${
                    compact ? "w-4 sm:w-10" : "w-6 sm:w-10"
                  } ${
                    step.number < currentStep ? "bg-emerald-400/70" : "bg-white/10"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}


