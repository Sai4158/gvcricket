"use client";

/**
 * File overview:
 * Purpose: Renders Rules UI for the app's screens and flows.
 * Main exports: RulesSection, RuleItem.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

export function RulesSection({ icon, title, headingColor, children }) {
  return (
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
}

export function RuleItem({ children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-green-400 mt-1.5">+</span>
      <p>{children}</p>
    </div>
  );
}


