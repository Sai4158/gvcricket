/* ------------------------------------------------------------------
   src/app/session/page.jsx – (Modernized Dark UI Version)
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
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

// --- PIN Entry Modal Component ---
const PinModal = ({ onPinSubmit, onExit }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    // The PIN is hardcoded here as "0000".
    if (pin === "0000") {
      onPinSubmit();
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  // Allows submitting with the Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
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

// --- Session Card Component ---
const SessionCard = ({ session, onUmpireClick }) => {
  const isLive = session.result === "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
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
                isLive ? "bg-red-500 animate-pulse" : "bg-green-500"
              }`}
            ></div>
            <span
              className={`text-xs font-bold ${
                isLive ? "text-red-300" : "text-green-300"
              }`}
            >
              {isLive ? "Live" : "Done"}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="flex gap-3 flex-wrap mt-auto">
        {session.match && (
          <button
            onClick={() => onUmpireClick(session, isLive)} // Pass isLive along with session
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-500 transition flex items-center justify-center gap-2"
          >
            <FaLock />
            <span>{isLive ? "Umpire Mode (Live)" : "Umpire Mode (Saved)"}</span>
          </button>
        )}
        <Link
          href={`/session/${session._id}/view`}
          className="flex-1 px-4 py-2 rounded-lg bg-green-700 ring-1 ring-black text-white font-semibold hover:bg-zinc-700 text-center transition flex items-center justify-center gap-2"
        >
          <FaEye />
          <span>View</span>
        </Link>
      </div>
    </motion.div>
  );
};

// --- Main Page Component ---
export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null); // For PIN modal
  const router = useRouter();

  // Accept sessionIsLive argument from SessionCard
  const handleUmpireClick = (session, sessionIsLive) => {
    setSelectedSession({ ...session, sessionIsLive }); // Store it in selectedSession
  };

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data ?? []))
      .catch((e) => {
        console.error(e);
        // Handle error with a state update instead of alert
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePinSubmit = () => {
    if (!selectedSession) return;

    // Use the sessionIsLive property stored in selectedSession
    const path = selectedSession.sessionIsLive
      ? `/match/${selectedSession.match}`
      : `/result/${selectedSession.match}`;

    router.push(path);
    setSelectedSession(null); // Close modal
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

        <h1 className="text-4xl text-center font-extrabold text-white mt-10 mb-5">
          All Sessions
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => (
            <SessionCard
              key={s._id}
              session={s}
              // FIX: Correctly pass the session and its isLive status to handleUmpireClick
              onUmpireClick={(clickedSession, clickedIsLive) =>
                handleUmpireClick(clickedSession, clickedIsLive)
              }
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
      </AnimatePresence>
    </main>
  );
}
