/* ------------------------------------------------------------------
   src/app/session/page.jsx – (Final UI Polish)
-------------------------------------------------------------------*/
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaArrowLeft,
  FaShieldAlt,
  FaEye,
  FaLock,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

// --- PIN Entry Modal Component (No changes needed) ---
const PinModal = ({ onPinSubmit, onExit }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = () => {
    if (pin === "0000") onPinSubmit();
    else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSubmit();
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onExit}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-sm bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <FaShieldAlt className="mx-auto text-5xl text-blue-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Umpire Mode PIN</h2>
        <p className="text-zinc-400 mb-6">
          Enter the PIN to access scoring controls.
        </p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyPress={handleKeyPress}
          maxLength={4}
          className="w-full p-4 text-center text-2xl tracking-[1rem] rounded-lg bg-zinc-800 ring-1 ring-zinc-700 focus:ring-blue-500 outline-none text-white placeholder:text-zinc-500 transition"
          placeholder="----"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        <button
          onClick={handleSubmit}
          className="w-full mt-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          Enter
        </button>
      </motion.div>
    </motion.div>
  );
};

// --- ✨ NEW: Updated Information Modal ---
const InfoModal = ({ onExit }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onExit}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-zinc-900 p-8 rounded-2xl ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Legend & Controls</h2>
          <button
            onClick={onExit}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="space-y-6 text-left">
          {/* Status Legend */}
          <div>
            <h3 className="font-bold text-lg text-white mb-2">
              Status Indicators
            </h3>
            <div className="flex items-start gap-4 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-zinc-100">Live</h4>
                <p className="text-zinc-400 text-sm">
                  This match is currently in progress.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-zinc-100">Ended</h4>
                <p className="text-zinc-400 text-sm">This match is finished.</p>
              </div>
            </div>
          </div>
          {/* Button Explanations */}
          <div>
            <h3 className="font-bold text-lg text-white mb-3">Buttons</h3>
            <div className="flex items-start gap-4 mb-3">
              <div className="text-blue-500 mt-0.5 flex-shrink-0">
                <FaLock size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-100">Umpire Mode</h4>
                <p className="text-zinc-400 text-sm">
                  Continue scoring a live match. Requires a PIN to access the
                  controls.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-green-500 mt-0.5 flex-shrink-0">
                <FaEye size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-100">See Score</h4>
                <p className="text-zinc-400 text-sm">
                  Open the spectator view. Anyone can see the live score or
                  review a finished game.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Session Card Component (Updated with new button logic) ---
const SessionCard = ({ session, onUmpireClick }) => {
  const isLive = session.isLive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 ring-1 ring-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:ring-white/20 transition-all"
    >
      <div>
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold mb-1 text-white">
            {session.name || "Untitled Session"}
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isLive ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span
              className={`text-xs font-bold ${
                isLive ? "text-green-300" : "text-red-300"
              }`}
            >
              {isLive ? "Live" : "Ended"}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="flex gap-3 flex-wrap mt-auto">
        {/* ✅ Umpire Mode button only shows if the match is live */}
        {isLive && session.match && (
          <button
            onClick={() => onUmpireClick(session)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-500 transition flex items-center justify-center gap-2"
          >
            <FaLock />
            <span>Umpire Mode</span>
          </button>
        )}

        {/* ✅ "See Score" button is always visible (if there's a match) and is now green */}
        {session.match && (
          <Link
            href={`/session/${session._id}/view`}
            className="flex-1 px-4 py-2.5 rounded-lg bg-green-700 text-white font-semibold hover:bg-green-600 text-center transition flex items-center justify-center gap-2"
          >
            <FaEye />
            <span>See Score</span>
          </Link>
        )}
      </div>
    </motion.div>
  );
};

// --- Main Page Component ---
export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const router = useRouter();

  const handleUmpireClick = (session) => {
    setSelectedSession(session);
  };

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data ?? []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handlePinSubmit = () => {
    if (!selectedSession || !selectedSession.isLive) return;
    router.push(`/match/${selectedSession.match}`);
    setSelectedSession(null);
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center text-xl text-white bg-zinc-950">
        Loading...
      </main>
    );

  if (!sessions.length)
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
          {sessions.map((s) => (
            <SessionCard
              key={s._id}
              session={s}
              onUmpireClick={handleUmpireClick}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedSession && (
          <PinModal
            onPinSubmit={handlePinSubmit}
            onExit={() => setSelectedSession(null)}
          />
        )}
        {isInfoModalOpen && (
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
