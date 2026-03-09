"use client";

import { motion } from "framer-motion";
import { FaEye, FaLock, FaTimes } from "react-icons/fa";

export default function InfoModal({ onExit }) {
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
          <h2 className="text-2xl font-bold text-white">Legend and Controls</h2>
          <button
            onClick={onExit}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="space-y-6 text-left">
          <div>
            <h3 className="font-bold text-lg text-white mb-2">
              Status Indicators
            </h3>
            <div className="flex items-start gap-4 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-zinc-100">LIVE NOW</h4>
                <p className="text-zinc-400 text-sm">
                  This match is currently in progress.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
              <div>
                <h4 className="font-semibold text-zinc-100">Ended Recently</h4>
                <p className="text-zinc-400 text-sm">
                  This match is finished. The timestamp reflects the last score
                  update.
                </p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-3">Buttons</h3>
            <div className="flex items-start gap-4 mb-3">
              <div className="text-blue-500 mt-0.5 flex-shrink-0">
                <FaLock size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-100">Umpire Mode</h4>
                <p className="text-zinc-400 text-sm">
                  Continue scoring a live match. Requires the server PIN.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-yellow-400 mt-0.5 flex-shrink-0">
                <FaEye size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-100">View Score</h4>
                <p className="text-zinc-400 text-sm">
                  Open the spectator or final score view for a session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
