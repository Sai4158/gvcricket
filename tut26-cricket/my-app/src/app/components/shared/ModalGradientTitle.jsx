"use client";

import LiquidSportText from "../home/LiquidSportText";

export default function ModalGradientTitle({
  as = "h2",
  text = "",
  className = "",
}) {
  const finalClassName = ["font-black tracking-[-0.03em]", className]
    .filter(Boolean)
    .join(" ");

  return (
    <LiquidSportText
      as={as}
      text={text}
      variant="hero-bright"
      simplifyMotion
      className={finalClassName}
    />
  );
}
