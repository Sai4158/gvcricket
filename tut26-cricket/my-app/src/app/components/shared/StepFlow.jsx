"use client";

const STEPS = [
  { number: 1, label: "Session" },
  { number: 2, label: "Teams" },
  { number: 3, label: "Toss" },
  { number: 4, label: "Start" },
];

export default function StepFlow({ currentStep = 1, className = "" }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const isDone = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <div key={step.number} className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold transition ${
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
                  className={`text-[10px] font-medium uppercase tracking-[0.18em] ${
                    isCurrent
                      ? "text-zinc-200"
                      : isDone
                      ? "text-emerald-200/85"
                      : "text-zinc-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  className={`block h-[2px] w-6 rounded-full sm:w-10 ${
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
