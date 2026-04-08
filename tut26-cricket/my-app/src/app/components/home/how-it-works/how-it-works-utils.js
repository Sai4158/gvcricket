/**
 * File overview:
 * Purpose: Pure presentation helpers for the home how-it-works experience.
 * Main exports: compact copy, accent, and desktop grid helper functions.
 * Major callers: HowItWorksSectionContent.
 * Side effects: none.
 * Read next: ./HowItWorksSectionContent.jsx
 */

export function getJourneyStepLabel(index) {
  return `Step ${String(index + 1).padStart(2, "0")}`;
}

export function getCompactCardCopy(copy) {
  const text = String(copy || "").trim();

  if (!text) {
    return "";
  }

  const sentences =
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) || [];

  if (!sentences.length) {
    return text;
  }

  if (sentences.length === 1) {
    return sentences[0];
  }

  return `${sentences[0]} ${sentences[1]}`.trim();
}

export function getAccentRail(accent) {
  switch (accent) {
    case "amber":
      return "from-rose-500 via-orange-400 to-amber-300";
    case "emerald":
      return "from-emerald-400 via-teal-300 to-cyan-400";
    case "rose":
      return "from-rose-500 via-pink-400 to-orange-400";
    case "violet":
      return "from-violet-400 via-fuchsia-400 to-indigo-400";
    case "yellow":
      return "from-amber-300 via-yellow-200 to-orange-400";
    case "orange":
      return "from-orange-400 via-amber-300 to-sky-400";
    default:
      return "from-sky-400 via-cyan-300 to-blue-500";
  }
}


export function getFeatureCardWideSpan(previewType) {
  return "2xl:col-span-3";
}

export function getJourneyCardWideSpan() {
  return "2xl:col-span-4";
}

export function getFeatureCardWideOrder(previewType) {
  switch (previewType) {
    case "walkie":
      return "2xl:order-1";
    case "loudspeaker":
      return "2xl:order-2";
    case "director":
      return "2xl:order-3";
    case "announcer":
      return "2xl:order-4";
    case "share":
      return "2xl:order-5";
    case "cover":
      return "2xl:order-6";
    case "insights":
      return "2xl:order-7";
    case "livebanner":
      return "2xl:order-8";
    default:
      return "";
  }
}

export function getAccentHueLayers(accent) {
  switch (accent) {
    case "amber":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(251,146,60,0.22)_0%,rgba(245,158,11,0.12)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,113,133,0.14)_0%,rgba(251,146,60,0.08)_44%,transparent_78%)]",
      };
    case "emerald":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(16,185,129,0.22)_0%,rgba(34,211,238,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(45,212,191,0.14)_0%,rgba(14,165,233,0.08)_44%,transparent_78%)]",
      };
    case "rose":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(244,63,94,0.2)_0%,rgba(251,113,133,0.11)_40%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,146,60,0.14)_0%,rgba(244,63,94,0.08)_46%,transparent_78%)]",
      };
    case "violet":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(168,85,247,0.22)_0%,rgba(99,102,241,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(217,70,239,0.14)_0%,rgba(129,140,248,0.08)_46%,transparent_78%)]",
      };
    case "yellow":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(250,204,21,0.2)_0%,rgba(251,146,60,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(253,224,71,0.14)_0%,rgba(250,204,21,0.08)_46%,transparent_78%)]",
      };
    case "orange":
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(249,115,22,0.22)_0%,rgba(56,189,248,0.1)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(251,191,36,0.14)_0%,rgba(14,165,233,0.08)_46%,transparent_78%)]",
      };
    default:
      return {
        primary:
          "bg-[radial-gradient(circle,rgba(56,189,248,0.2)_0%,rgba(96,165,250,0.11)_42%,transparent_74%)]",
        secondary:
          "bg-[radial-gradient(circle,rgba(34,211,238,0.14)_0%,rgba(99,102,241,0.08)_46%,transparent_78%)]",
      };
  }
}

