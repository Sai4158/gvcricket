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
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-200 p-4">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-2xl shadow-2xl ring-1 ring-white/10">
        <h1 className="text-4xl font-bold text-center text-white mb-2">
          Create New Session
        </h1>
        <p className="text-center text-zinc-400 mb-8">
          Start by giving your match a name and date.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="session-name"
              className="text-sm font-medium text-zinc-400"
            >
              Session Name
            </label>
            <div className="relative mt-1">
              <FaPen className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="session-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Game 1, 2, etc."
                className="w-full p-3 pl-10 rounded-lg bg-zinc-800/50 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white placeholder:text-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="session-date"
              className="text-sm font-medium text-zinc-400"
            >
              Date
            </label>
            <div className="relative mt-1">
              <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="session-date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                placeholder="e.g. 6/6/2025"
                className="w-full p-3 pl-10 rounded-lg bg-zinc-800/50 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white placeholder:text-zinc-500 transition"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 text-center bg-red-900/30 text-red-300 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={createSession}
          disabled={saving}
          className="w-full mt-8 py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 text-black text-xl shadow-lg shadow-blue-600/20 hover:scale-105 disabled:opacity-60 disabled:shadow-none disabled:bg-zinc-700"
        >
          {saving ? "Creating..." : "Next: Select Teams"}
          {!saving && <FaArrowRight />}
        </button>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-white hover:text-zinc-300 transition">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
