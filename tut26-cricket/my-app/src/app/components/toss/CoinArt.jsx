"use client";

function CoinShell({ rimStroke, frontFill, backFill, text, textColor, imageSize = 34 }) {
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
        y="25"
        fontFamily="Arial, sans-serif"
        fontSize="13"
        fill={textColor}
        textAnchor="middle"
        fontWeight="800"
        letterSpacing="4"
      >
        {text}
      </text>
      <image
        href="/gv.png"
        x={60 - imageSize / 2}
        y={60 - imageSize / 2 - 2}
        width={imageSize}
        height={imageSize}
        preserveAspectRatio="xMidYMid meet"
      />
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
      imageSize={38}
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
      imageSize={38}
    />
  );
}

export function SpinningCoin() {
  return (
    <svg width="180" height="180" viewBox="0 0 120 120" fill="none">
      <defs>
        <radialGradient id="spin-grad">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
      </defs>
      <ellipse
        cx="60"
        cy="60"
        rx="38"
        ry="55"
        fill="url(#spin-grad)"
        stroke="#8a6200"
        strokeWidth="5"
      />
      <ellipse cx="60" cy="60" rx="30" ry="47" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      <image
        href="/gv.png"
        x="41"
        y="42"
        width="38"
        height="38"
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x="60"
        y="22"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fill="#5f4300"
        textAnchor="middle"
        fontWeight="800"
        letterSpacing="3"
      >
        HEADS
      </text>
      <text
        x="60"
        y="103"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fill="#5f4300"
        textAnchor="middle"
        fontWeight="800"
        letterSpacing="3"
      >
        TAILS
      </text>
    </svg>
  );
}
