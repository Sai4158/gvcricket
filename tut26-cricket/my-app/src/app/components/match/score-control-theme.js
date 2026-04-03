import { Rajdhani } from "next/font/google";

export const scoreControlFont = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export function getScoreControlToneClasses(tone = "neutral") {
  if (tone === "dot") {
    return "bg-sky-700 hover:bg-sky-600";
  }

  if (tone === "out") {
    return "bg-rose-700 hover:bg-rose-600";
  }

  if (tone === "wide") {
    return "bg-green-600 hover:bg-green-500";
  }

  if (tone === "noball") {
    return "bg-orange-600 hover:bg-orange-500";
  }

  return "bg-zinc-800 hover:bg-zinc-700";
}
