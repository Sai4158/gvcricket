"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaEye, FaLock } from "react-icons/fa";
import { formatRelativeTime } from "./formatRelativeTime";

export default function SessionCard({ session, onUmpireClick }) {
  const isLive = session.isLive;
  const scoreHref =
    session.match && !isLive
      ? `/result/${session.match}`
      : session.match
      ? `/session/${session._id}/view`
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 ring-1 ring-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:ring-white/20 transition-all"
    >
      <div>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1 text-white">
              {session.name || "Untitled Session"}
            </h2>
            {session.date && <p className="text-sm text-zinc-400">{session.date}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isLive ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span
              className={`text-xs font-bold capitalize ${
                isLive ? "text-green-300" : "text-red-300"
              }`}
            >
              {isLive
                ? "LIVE NOW"
                : `Ended ${formatRelativeTime(
                    session.updatedAt || session.createdAt
                  )}`}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="flex gap-3 flex-wrap mt-auto">
        {isLive && session.match && (
          <button
            onClick={() => onUmpireClick(session)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-500 transition flex items-center justify-center gap-2"
          >
            <FaLock />
            <span>Umpire Mode</span>
          </button>
        )}

        {session.match && (
          <Link
            href={scoreHref}
            prefetch={false}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-center transition flex items-center justify-center gap-2 ${
              isLive
                ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:brightness-110"
                : "bg-green-700 text-white hover:bg-green-600"
            }`}
          >
            <FaEye />
            <span>{isLive ? "View Live Score" : "See Final Score"}</span>
          </Link>
        )}

        {!session.match && !isLive && (
          <div className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 font-semibold text-center">
            No saved score
          </div>
        )}
      </div>
    </motion.div>
  );
}
