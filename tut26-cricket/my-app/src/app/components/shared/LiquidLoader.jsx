"use client";

export default function LiquidLoader({
  size = "md",
  label = "Loading",
  className = "",
}) {
  const sizeClasses =
    size === "sm"
      ? "h-4 w-4"
      : size === "lg"
      ? "h-8 w-8"
      : "h-5 w-5";

  return (
    <span
      className={`inline-flex items-center gap-2 text-zinc-200 ${className}`}
      aria-live="polite"
      aria-label={label}
    >
      <span
        className={`relative inline-flex ${sizeClasses} items-center justify-center`}
        aria-hidden="true"
      >
        <span className="absolute inset-0 rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm" />
        <span className="absolute inset-[2px] rounded-full border-2 border-transparent border-t-white/85 border-r-white/30 animate-spin" />
      </span>
    </span>
  );
}
