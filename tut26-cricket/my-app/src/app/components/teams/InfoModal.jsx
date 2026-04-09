"use client";

/**
 * File overview:
 * Purpose: Renders Teams UI for the app's screens and flows.
 * Main exports: TeamsInfoModal.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";

export default function TeamsInfoModal({ onExit }) {
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
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Team Setup</h2>
          <button
            onClick={onExit}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="space-y-5 text-left">
          <div>
            <h3 className="font-bold text-lg text-amber-300 mb-1">
              1. Player Count
            </h3>
            <p className="text-zinc-300">Use <strong className="text-white">+/-</strong> to change players.</p>
          </div>
          <div>
            <h3 className="font-bold text-lg text-amber-300 mb-1">
              2. Edit Names
            </h3>
            <p className="text-zinc-300">Tap edit to change team or player names.</p>
          </div>
          <div>
            <h3 className="font-bold text-lg text-amber-300 mb-1">
              3. Remove Player
            </h3>
            <p className="text-zinc-300">While editing, tap the trash icon to remove a player.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


