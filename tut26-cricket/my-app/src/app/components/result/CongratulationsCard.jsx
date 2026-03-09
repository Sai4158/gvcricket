"use client";

import { motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";

export default function CongratulationsCard({ result }) {
  const winnerName = result.split(" won by")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white p-8 rounded-2xl shadow-2xl shadow-amber-500/10 text-center"
    >
      <FaTrophy className="mx-auto text-6xl mb-4 text-yellow-300" />
      <h1 className="text-4xl font-extrabold tracking-tight text-yellow-50">
        Congratulations,
        <br />
        {winnerName}!
      </h1>
      <p className="text-2xl mt-2 font-medium">{result}</p>
    </motion.div>
  );
}
