"use client";


/**
 * File overview:
 * Purpose: UI component for Shared screens and flows.
 * Main exports: ModalGradientTitle.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: README.md
 */
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
