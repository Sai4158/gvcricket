/**
 * File overview:
 * Purpose: Renders crawlable homepage FAQ content for search engines and users.
 * Main exports: HomeSeoSection.
 * Major callers: Home page route.
 * Side effects: none.
 * Read next: ./README.md
 */

import Image from "next/image";
import { FaChevronDown, FaQuestionCircle } from "react-icons/fa";
import HomeScrollFade from "./HomeScrollFade";
import LiquidSportText from "./LiquidSportText";

const faqItems = [
  {
    question: "What is GV Cricket?",
    answer:
      "GV Cricket is a live cricket scoring website and mobile-friendly cricket score app for scoring matches ball by ball, sharing live scores, and publishing match results.",
  },
  {
    question: "How do I start a match in GV Cricket?",
    answer:
      "Start by creating a new session, setting up the teams, and opening the match controls. From there you can run the toss, begin the innings, and start scoring live ball by ball.",
  },
  {
    question: "How does the toss work in GV Cricket?",
    answer:
      "GV Cricket includes a toss flow as part of match setup so you can record the toss winner and the batting or bowling decision before the first ball is scored.",
  },
  {
    question: "How do I score a live cricket match ball by ball?",
    answer:
      "Use the umpire scoring controls to record runs, wickets, wides, no balls, and over progress one ball at a time. The scoreboard updates live as you score the match.",
  },
  {
    question: "Can I undo or correct a scoring mistake?",
    answer:
      "Yes. GV Cricket supports undo and score correction so you can fix a wrong entry and keep the match score accurate while play continues.",
  },
  {
    question: "How do I share the live match with spectators?",
    answer:
      "Each match can provide a shareable live score view so spectators can follow the score, overs, wickets, and match progress from their own device.",
  },
  {
    question: "Can spectators follow the live cricket score?",
    answer:
      "Yes. GV Cricket shows spectators a public live score view with runs, wickets, overs, and live match updates as the game moves along.",
  },
  {
    question: "How do I share the final result after the match ends?",
    answer:
      "Once the match is complete, GV Cricket can show a result page with the final score and match outcome, which makes it easy to share the result after the last ball.",
  },
  {
    question: "What is the score announcer in GV Cricket?",
    answer:
      "The score announcer reads match updates aloud during play so the current score and key events can be heard without everyone watching the screen.",
  },
  {
    question: "Can I use sound effects during a live match?",
    answer:
      "Yes. GV Cricket includes sound effects that can be triggered during live scoring to add energy and make key moments feel more immediate.",
  },
  {
    question: "Does GV Cricket support ball-by-ball cricket scoring?",
    answer:
      "Yes. GV Cricket is built for ball-by-ball cricket scoring so scorers and umpires can track each delivery, over progress, and innings flow clearly.",
  },
  {
    question: "Does GV Cricket work well on mobile phones?",
    answer:
      "Yes. The scoring flow is designed for phones first, with fast taps, quick over tracking, and a simple layout that works during real matches.",
  },
  {
    question: "Can GV Cricket be used for local leagues and tournaments?",
    answer:
      "Yes. GV Cricket works for local league matches, tournament play, school cricket, community games, tennis-ball cricket, and box cricket.",
  },
  {
    question: "Can GV Cricket create match result pages?",
    answer:
      "Yes. After the match ends, GV Cricket can show a final result page with the score, match outcome, and key match details for players and spectators.",
  },
];

function FaqItem({ item }) {
  return (
    <details className="group self-start overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(180deg,rgba(20,20,26,0.9),rgba(10,10,14,0.94))] shadow-[0_20px_48px_rgba(0,0,0,0.24)] sm:liquid-glass">
      <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 text-left sm:px-6 sm:py-6">
        <span className="liquid-icon mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
          <FaQuestionCircle />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-7 text-white sm:text-lg">
            {item.question}
          </span>
        </span>
        <span className="pt-1 text-zinc-300 transition-transform duration-300 group-open:rotate-180">
          <FaChevronDown />
        </span>
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <p className="border-t border-white/8 pt-4 text-sm leading-6 text-zinc-300 sm:text-[15px]">
          {item.answer}
        </p>
      </div>
    </details>
  );
}

export default function HomeSeoSection() {
  return (
    <section
      id="home-faq"
      aria-label="GV Cricket frequently asked questions"
      className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[108rem]"
    >
      <div className="relative overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(16,16,22,0.9),rgba(7,7,11,0.94))] px-5 py-7 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:px-6 sm:py-8 md:px-8 md:py-10 xl:px-10 xl:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(34,197,94,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.07),transparent_24%)]" />

        <div className="relative z-10">
          <HomeScrollFade
            delayMs={40}
            distance={12}
            viewportAmount={0.14}
            className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]"
          >
            <div className="min-w-0">
              <h2 className="text-3xl font-semibold leading-[1.02] tracking-tight text-white md:hidden">
                Questions about live cricket scoring?
                <span className="mt-1 block">Start here.</span>
              </h2>
              <LiquidSportText
                as="h2"
                text={["Questions about live cricket scoring?", "Start here."]}
                characterTyping
                characterStagger={0.02}
                characterLineDelay={0.12}
                characterDuration={0.34}
                simplifyMotion
                lightweightCharacterReveal
                delay={0.03}
                className="hidden text-3xl font-semibold tracking-tight sm:text-4xl md:block md:text-5xl"
                lineClassName="leading-[1.02]"
              />
              <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base md:text-lg">
                Find quick answers about using GV Cricket as a live cricket
                score app, cricket scorekeeper, free cricket scorer, and match
                result tool for local matches, leagues, and tournaments.
              </p>
            </div>
            <div className="hidden justify-end lg:flex">
              <Image
                src="/gvLogo.png"
                alt="GV Cricket logo"
                width={224}
                height={224}
                className="h-auto w-full max-w-[11rem] object-contain drop-shadow-[0_16px_34px_rgba(0,0,0,0.34)]"
              />
            </div>
          </HomeScrollFade>

          <HomeScrollFade
            delayMs={90}
            distance={14}
            viewportAmount={0.08}
            className="mt-8 grid items-start gap-4 lg:grid-cols-2"
          >
            {faqItems.map((item) => (
              <FaqItem key={item.question} item={item} />
            ))}
          </HomeScrollFade>
        </div>
      </div>
    </section>
  );
}

export { faqItems };
