/**
 * File overview:
 * Purpose: Renders crawlable homepage copy and FAQ content for search engines and users.
 * Main exports: HomeSeoSection.
 * Major callers: Home page route.
 * Side effects: none.
 * Read next: ./README.md
 */

const audienceCards = [
  {
    title: "Live cricket scoring for local matches",
    copy:
      "Run a live cricket scoreboard for club matches, community games, weekend tournaments, and school cricket without needing a complicated scoring setup.",
  },
  {
    title: "Free cricket scorer with umpire mode",
    copy:
      "Score balls quickly with umpire mode, instant over tracking, undo support, and a clean mobile-first scoring flow built for real match pressure.",
  },
  {
    title: "Spectator scoreboards and instant results",
    copy:
      "Share a live cricket score link, show spectators the current over and wickets, and publish a final result page as soon as the match ends.",
  },
  {
    title: "Built for leagues, box cricket, and tennis-ball cricket",
    copy:
      "Use the same scoring flow across league games, box cricket, tennis-ball cricket, practice games, and IPL-style local tournaments.",
  },
];

const faqItems = [
  {
    question: "What is GV Cricket?",
    answer:
      "GV Cricket is a live cricket scoring website and mobile-friendly cricket score app for scoring matches ball by ball, sharing live scores, and publishing match results.",
  },
  {
    question: "Is GV Cricket free to use?",
    answer:
      "Yes. GV Cricket is designed as a free cricket scorer for local matches, community cricket, school games, and tournaments.",
  },
  {
    question: "Can I use GV Cricket for local leagues and tournaments?",
    answer:
      "Yes. You can use it for local league matches, tournament play, box cricket, tennis-ball cricket, and other community cricket formats.",
  },
  {
    question: "Can spectators follow the live cricket score?",
    answer:
      "Yes. Each session can share a public live score view with runs, wickets, overs, and match updates for spectators.",
  },
  {
    question: "Does GV Cricket work for long matches and fast scoring?",
    answer:
      "Yes. The app is designed for quick ball-by-ball scoring with umpire mode as the highest-priority flow, even during long matches.",
  },
];

export default function HomeSeoSection() {
  return (
    <section
      aria-labelledby="home-seo-heading"
      className="mx-auto w-full max-w-6xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,14,0.94))] px-6 py-8 shadow-[0_28px_70px_rgba(0,0,0,0.38)] md:px-8 md:py-10 xl:max-w-7xl 2xl:max-w-[108rem]"
    >
      <div className="max-w-4xl">
        <p className="inline-flex rounded-full border border-emerald-400/18 bg-emerald-400/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
          Cricket Scoring Platform
        </p>
        <h2
          id="home-seo-heading"
          className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl"
        >
          Free live cricket scoring for clubs, local matches, tournaments, and
          community games
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 md:text-lg">
          GV Cricket helps players, umpires, organizers, and spectators manage a
          full cricket match from toss to result. Use it as a live cricket score
          app, a mobile cricket scorekeeper, or a free cricket scorer for local
          leagues, school cricket, box cricket, and tennis-ball cricket.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {audienceCards.map((item) => (
          <article
            key={item.title}
            className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5"
          >
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300 md:text-[15px]">
              {item.copy}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div>
          <h3 className="text-2xl font-semibold text-white">
            Why this helps search visibility
          </h3>
          <p className="mt-3 text-sm leading-7 text-zinc-300 md:text-base">
            Search engines rank pages that clearly explain what the product does,
            who it serves, and which problems it solves. This page now explains
            that GV Cricket is a live cricket scoring app for real matches, free
            cricket scoring, public scoreboards, and instant match results.
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-300 md:text-base">
            That gives the site stronger relevance for searches around live
            cricket scoring, cricket score apps, cricket scorekeepers, and match
            result pages without using hidden keyword stuffing.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/25 p-5">
          <h3 className="text-xl font-semibold text-white">Popular use cases</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            <li>Live cricket scoring for club and community matches</li>
            <li>Free cricket scorer for practice games and local tournaments</li>
            <li>Public spectator scoreboards with overs and wickets</li>
            <li>Fast umpire scoring for long matches and high tap volume</li>
            <li>Instant cricket result pages after each match</li>
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-2xl font-semibold text-white">FAQ</h3>
        <div className="mt-5 space-y-4">
          {faqItems.map((item) => (
            <article
              key={item.question}
              className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5"
            >
              <h4 className="text-base font-semibold text-white">
                {item.question}
              </h4>
              <p className="mt-2 text-sm leading-6 text-zinc-300 md:text-[15px]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export { faqItems };
