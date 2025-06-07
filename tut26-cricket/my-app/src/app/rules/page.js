/* ---------------------------------------------------------------
   src/app/rules/page.jsx – (Final, Modernized Dark UI Version)
---------------------------------------------------------------- */
"use client";

import Link from "next/link";
import {
  FaArrowLeft,
  FaGamepad,
  FaGavel,
  FaMapMarkerAlt,
  FaMobileAlt,
  FaBalanceScale,
  FaHandshake,
} from "react-icons/fa";

// --- Re-usable UI Components ---

const Section = ({ icon, title, headingColor, children }) => (
  <section className="w-full max-w-3xl bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 mb-8 ring-1 ring-white/10 shadow-2xl">
    <h2
      className={`text-2xl font-bold mb-5 flex items-center gap-3 ${headingColor}`}
    >
      {icon}
      <span>{title}</span>
    </h2>
    <div className="space-y-3 text-zinc-300 leading-relaxed">{children}</div>
  </section>
);

const RuleItem = ({ children }) => (
  <div className="flex items-start gap-3">
    <span className="text-green-400 mt-1.5">✓</span>
    <p>{children}</p>
  </div>
);

// --- Main Rules Page Component ---

export default function RulesPage() {
  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center bg-zinc-950 text-zinc-200 font-sans">
      <div className="w-full max-w-3xl mb-10 text-center relative">
        <Link
          href="/"
          className="absolute left-0 top-5 -translate-y-1/2 text-sm text-white hover:text-white flex items-center gap-2 transition"
        >
          <FaArrowLeft /> Back
        </Link>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-15">
          GV Cricket Rules
        </h1>
      </div>

      {/* --- Core Gameplay Rules --- */}
      <Section
        icon={<FaGamepad />}
        title="Core Gameplay"
        headingColor="text-green-400"
      >
        <RuleItem>
          Max <strong>3 overs</strong> per batsman.
        </RuleItem>
        <RuleItem>
          Max <strong>2 overs</strong> per bowler.
        </RuleItem>
        <RuleItem>
          To score a run, the ball must touch the grass (no runs for aerial
          flicks).
        </RuleItem>
        <RuleItem>
          An umpire and wicket-keeper must be present at all times.
        </RuleItem>
      </Section>

      {/* --- Fair Play & Team Selection --- */}
      <Section
        icon={<FaBalanceScale />}
        title="Fair Play & Team Selection"
        headingColor="text-teal-400"
      >
        <RuleItem>
          All players must bat for a minimum of <strong>1 over</strong>.
        </RuleItem>
        <RuleItem>
          All players must bowl for a minimum of <strong>1 over</strong>.
        </RuleItem>
        <RuleItem>
          To prevent disputes, teams must be <strong>randomized</strong> for
          every match.
        </RuleItem>
        <RuleItem>
          The toss-winning captain chooses to bat or bowl. The opposing captain
          gets the <strong>first pick</strong> when selecting teams.
        </RuleItem>
        <RuleItem>
          For fair rotation, the player who bats first will bowl last. The
          player who bowls first will bat last.
        </RuleItem>
      </Section>

      {/* --- Spirit of the Game (Friendly Rules) --- */}
      <Section
        icon={<FaHandshake />}
        title="Spirit of the Game"
        headingColor="text-yellow-400"
      >
        <RuleItem>
          Prioritize fun and sportsmanship. This is a friendly game.
        </RuleItem>
        <RuleItem>
          No cursing or insulting other players is allowed. Respect is
          mandatory.
        </RuleItem>
        <RuleItem>Encourage and support new or inexperienced players.</RuleItem>
        <RuleItem>
          Rotate umpire and wicket keeper duties fairly among all players.
        </RuleItem>
      </Section>

      {/* --- Umpiring & Dismissals --- */}
      <Section
        icon={<FaGavel />}
        title="Umpiring & Dismissals"
        headingColor="text-red-400"
      >
        <RuleItem>
          The umpire's decision is final and must be called loudly.
        </RuleItem>
        <RuleItem>Stumping is allowed.</RuleItem>
        <RuleItem>
          There are <strong>no LBWs</strong> (Leg Before Wicket).
        </RuleItem>
        <RuleItem>
          There are <strong>no back runs</strong> or runs inside the pitch area.
        </RuleItem>
        <RuleItem>
          A full toss delivery above the waist is a <strong>no ball</strong>,
          resulting in a free hit on the next ball.
        </RuleItem>
      </Section>

      {/* --- Field-Specific Rules --- */}
      <Section
        icon={<FaMapMarkerAlt />}
        title="Field-Specific Rules"
        headingColor="text-sky-400"
      >
        <RuleItem>
          <strong>At Bethel Ground:</strong> A ball hitting the fence is awarded{" "}
          <strong>2 runs only</strong>.
        </RuleItem>
        <RuleItem>
          <strong>At GV Ground:</strong> Normal boundary rules (4s and 6s)
          apply.
        </RuleItem>
      </Section>

      {/* --- App Usage Guide --- */}
      <Section
        icon={<FaMobileAlt />}
        title="App Guide"
        headingColor="text-amber-400"
      >
        <RuleItem>
          <strong>New Session:</strong> Start here to create a new match with a
          name and date.
        </RuleItem>
        <RuleItem>
          <strong>All Sessions:</strong> View a list of all past and live
          matches.
        </RuleItem>
        <RuleItem>
          <strong>Umpire Mode:</strong> PIN protected (<strong>0000</strong>)
          access to score a live match or view completed results.
        </RuleItem>
        <RuleItem>
          <strong>View:</strong> Public link for anyone to spectate a live
          score.
        </RuleItem>
        <RuleItem>
          <strong>Undo Button:</strong> Use immediately on the match page to
          correct a scoring mistake.
        </RuleItem>
      </Section>

      <div className="text-center pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 mb-5 rounded-xl shadow-lg hover:bg-blue-500 transition-colors"
        >
          <FaArrowLeft />
          Back to Home
        </Link>
        <br />
        <br />
      </div>
    </main>
  );
}
