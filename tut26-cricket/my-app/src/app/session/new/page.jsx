"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowRight, FaCalendarAlt, FaPen } from "react-icons/fa";

const today = new Date().toLocaleDateString("en-US");

export default function NewSessionPage() {
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const createSession = async () => {
    setError("");

    if (!name.trim()) {
      setError("Please enter a session name.");
      return;
    }

    if (!date.trim()) {
      setError("Please enter a valid date.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), date: date.trim() }),
      });

      if (!res.ok) {
        const errData = await res
          .json()
          .catch(() => ({ message: "An unknown error occurred." }));
        throw new Error(errData.message || "Failed to create session.");
      }

      const session = await res.json();
      router.push(`/teams/${session._id}`);
    } catch (caughtError) {
      setError(caughtError.message);
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#050505_0%,#0b0b11_52%,#050505_100%)] px-4 py-10 text-zinc-200">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
            New Match
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,10,0.98))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%)]" />
          <div className="relative">
            <h1 className="text-center text-4xl font-black leading-[0.98] text-white sm:text-5xl">
              Create New
              <span className="mt-1 block bg-gradient-to-r from-yellow-300 via-white to-amber-200 bg-clip-text text-transparent">
                Session
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-6 text-zinc-400">
              Name the match and set the date to continue.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="session-name"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                >
                  Session Name
                </label>
                <div className="group relative">
                  <FaPen className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-amber-300" />
                  <input
                    id="session-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Game 1, finals, or practice"
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] py-4 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(251,191,36,0.08)]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="session-date"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                >
                  Date
                </label>
                <div className="group relative">
                  <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-sky-300" />
                  <input
                    id="session-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    placeholder="e.g. 3/9/2026"
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] py-4 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-sky-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(56,189,248,0.08)]"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              onClick={createSession}
              disabled={saving}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(90deg,#facc15_0%,#f59e0b_54%,#fb7185_100%)] px-6 py-4 text-lg font-bold text-black shadow-[0_18px_40px_rgba(245,158,11,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {saving ? "Creating..." : "Next: Select Teams"}
              {!saving && <FaArrowRight />}
            </button>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
