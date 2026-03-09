"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaInfoCircle, FaPlus } from "react-icons/fa";
import InfoModal from "../components/session/InfoModal";
import PinModal from "../components/session/PinModal";
import SessionCard from "../components/session/SessionCard";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data ?? []))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  const handlePinSubmit = async (pin) => {
    if (!selectedSession?.match || !selectedSession.isLive) return;

    setPinSubmitting(true);
    setPinError("");

    try {
      const response = await fetch(`/api/matches/${selectedSession.match}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN." }));
        throw new Error(payload.message || "Incorrect PIN.");
      }

      router.push(`/match/${selectedSession.match}`);
      setSelectedSession(null);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-xl text-white bg-zinc-950">
        Loading...
      </main>
    );
  }

  if (!sessions.length) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-zinc-950 text-zinc-100">
        <h1 className="text-3xl font-bold tracking-tight">No sessions yet</h1>
        <Link
          href="/session/new"
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-lg flex items-center gap-2"
        >
          <FaPlus /> Create One
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 mt-5">
          <Link
            href="/"
            className="text-sm text-white hover:text-white flex items-center gap-2 transition font-bold"
          >
            <FaArrowLeft /> Back
          </Link>
          <Link
            href="/session/new"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow flex items-center gap-2"
          >
            <FaPlus /> New
          </Link>
        </div>
        <div className="flex justify-center items-center gap-3 mb-8">
          <h1 className="text-4xl text-center font-extrabold text-white">
            All Sessions
          </h1>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="text-zinc-500 hover:text-blue-400 transition-colors"
            aria-label="Information about statuses and controls"
          >
            <FaInfoCircle size={24} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <SessionCard
              key={session._id}
              session={session}
              onUmpireClick={(nextSession) => {
                setPinError("");
                setSelectedSession(nextSession);
              }}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {selectedSession && (
          <PinModal
            onPinSubmit={handlePinSubmit}
            onExit={() => {
              setSelectedSession(null);
              setPinError("");
            }}
            isSubmitting={pinSubmitting}
            error={pinError}
          />
        )}
        {isInfoModalOpen && (
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
