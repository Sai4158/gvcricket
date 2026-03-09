"use client";

import {
  FaCheckCircle,
  FaCoins,
  FaEye,
  FaListAlt,
  FaPenSquare,
  FaPlusCircle,
} from "react-icons/fa";
import AnimatedSection from "./AnimatedSection";

const cards = [
  {
    icon: FaListAlt,
    title: "Session Dashboard",
    copy:
      "Your central hub to see all past games, create new ones, or jump back into a unfinished match with a secure Umpire PIN.",
  },
  {
    icon: FaPenSquare,
    title: "Live Umpire Scoring",
    copy:
      "The umpire's cockpit. Score every ball with simple, color coded buttons for runs, wides, dots, and outs.",
  },
  {
    icon: FaEye,
    title: "Spectator View",
    copy:
      "Share the live scoreboard! Perfect for friends to follow along or for displaying the score on a big screen during a game. You can instantly see if the session is live or completed. live matches show a red pulse, and finished ones show green.",
  },
  {
    icon: FaPlusCircle,
    title: "New Match Setup",
    copy:
      "Start a game in seconds. Just enter a match name, add players to Team A & B, and pick the number of overs.",
  },
  {
    icon: FaCoins,
    title: "Animated Coin Toss",
    copy:
      "To make it official! A fun coin flip animation decides who bats first, then automatically starts the match.",
  },
  {
    icon: FaCheckCircle,
    title: "Final Results",
    copy:
      "Get an instant summary showing who won, the final scores, and key stats. All games are saved in the cloud for you to review later.",
  },
];

export default function HowItWorksSection() {
  return (
    <AnimatedSection className="w-full max-w-6xl mx-auto overflow-hidden">
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-12 space-y-12 ring-1 ring-white/10 shadow-2xl shadow-black/40">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-amber-300">
            How This App Works
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-white">
            Say goodbye to memorizing. <br /> <br /> This is a real time
            scoring tool designed for these games, perfect for practice
            matches, league play, or just having fun with friends.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10"
            >
              <card.icon className="mx-auto text-cyan-300 text-4xl mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {card.title}
              </h3>
              <p className="text-gray">{card.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}
