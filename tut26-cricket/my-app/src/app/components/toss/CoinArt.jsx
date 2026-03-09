"use client";

export function CoinHeads() {
  return (
    <svg width="160" height="160" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill="#ffc700" stroke="#b38b00" strokeWidth="4" />
      <text
        x="50"
        y="58"
        fontFamily="Arial, sans-serif"
        fontSize="22"
        fill="#664d00"
        textAnchor="middle"
        fontWeight="bold"
      >
        HEADS
      </text>
    </svg>
  );
}

export function CoinTails() {
  return (
    <svg width="160" height="160" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill="#cccccc" stroke="#8e8e8e" strokeWidth="4" />
      <text
        x="50"
        y="58"
        fontFamily="Arial, sans-serif"
        fontSize="22"
        fill="#4f4f4f"
        textAnchor="middle"
        fontWeight="bold"
      >
        TAILS
      </text>
    </svg>
  );
}

export function SpinningCoin() {
  return (
    <svg width="160" height="160" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill="url(#grad)" stroke="#b38b00" strokeWidth="4" />
      <defs>
        <radialGradient id="grad">
          <stop offset="0%" stopColor="#ffc700" />
          <stop offset="100%" stopColor="#b38b00" />
        </radialGradient>
      </defs>
    </svg>
  );
}
