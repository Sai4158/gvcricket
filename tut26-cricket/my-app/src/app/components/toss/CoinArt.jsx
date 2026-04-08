"use client";


/**
 * File overview:
 * Purpose: UI component for Toss screens and flows.
 * Main exports: CoinHeads, CoinTails, SpinningCoin.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ../README.md
 */
function CoinShell({
  rimStroke,
  frontFill,
  backFill,
  text,
  textColor,
}) {
  return (
    <svg width="180" height="180" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id={`coin-face-${text}`} cx="0" cy="0" r="1" gradientTransform="translate(60 52) rotate(90) scale(54)">
          <stop offset="0%" stopColor={frontFill} />
          <stop offset="100%" stopColor={backFill} />
        </radialGradient>
      </defs>
      <circle
        cx="60"
        cy="60"
        r="55"
        fill={`url(#coin-face-${text})`}
        stroke={rimStroke}
        strokeWidth="5"
      />
      <circle cx="60" cy="60" r="47" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      <text
        x="60"
        y="62"
        fontFamily="Arial, sans-serif"
        fontSize="16"
        fill={textColor}
        textAnchor="middle"
        fontWeight="800"
        letterSpacing="5"
      >
        {text}
      </text>
    </svg>
  );
}

export function CoinHeads() {
  return (
    <CoinShell
      rimStroke="#8a6200"
      frontFill="#facc15"
      backFill="#b8860b"
      text="HEADS"
      textColor="#5f4300"
    />
  );
}

export function CoinTails() {
  return (
    <CoinShell
      rimStroke="#7c8797"
      frontFill="#e5e7eb"
      backFill="#94a3b8"
      text="TAILS"
      textColor="#374151"
    />
  );
}

export function SpinningCoin() {
  return (
    <div className="relative h-[180px] w-[180px] [transform-style:preserve-3d]">
      <div className="absolute inset-0 [backface-visibility:hidden]">
        <CoinHeads />
      </div>
      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <CoinTails />
      </div>
    </div>
  );
}
