// src/app/not-found.jsx
"use client"; // This directive is necessary for client-side hooks and Framer Motion

import Link from "next/link";
import { motion } from "framer-motion";

// Define animation variants for staggered appearance
const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
      staggerChildren: 0.15, // Delay children animations
    },
  },
};

// Variants for individual text elements
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// IMPORTANT: Create a motion-enhanced Link component
const MotionLink = motion(Link);

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 to-black p-4 text-center overflow-hidden">
      {/* Optional: Subtle background radial gradient for depth */}
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(100, 100, 100, 0.1) 0%, transparent 70%)",
        }}
      ></div>

      <motion.div
        className="relative z-10 flex flex-col items-center justify-center max-w-2xl mx-auto p-8 md:p-12 bg-zinc-900/40 backdrop-blur-sm rounded-3xl shadow-2xl border border-zinc-800/50"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Main Headline (Changed order for 404 to be second, as per your last code's visual order change) */}
        <motion.h2
          className="text-4xl md:text-5xl font-bold text-zinc-100 mb-4 tracking-tight"
          variants={itemVariants}
        >
          That's A Wicket!
        </motion.h2>

        {/* 404 Title with gradient and shadow (Adjusted font size back to normal for 404 per original request) */}
        <motion.h1
          className="text-8xl md:text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 mb-6 drop-shadow-lg"
          variants={itemVariants}
        >
          404!
        </motion.h1>

        {/* Cricket-themed Message */}
        <motion.p
          className="text-lg md:text-xl text-zinc-100 leading-relaxed max-w-prose mb-10"
          variants={itemVariants}
        >
          It seems you've wandered off the pitch into an unmapped boundary. This
          area is strictly reserved for the strategists and statisticians, not
          for public play. Trying to sneak in? That's a definite **no-ball!**
        </motion.p>

        {/* Go Back Home Button */}
        <motion.div variants={itemVariants}>
          {/* FIX: Use the MotionLink component directly, and apply styles and motion props to it.
              The child of Link should be a plain HTML element or a React component.
              Next.js 13+ Link component renders the <a> tag automatically.
          */}
          <MotionLink
            href="/"
            className="inline-flex items-center px-8 py-4 bg-green-700 text-white font-semibold text-lg rounded-xl shadow-xl
                       hover:bg-green-600 hover:scale-105 transition-all duration-300 transform
                       focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 20px rgba(74, 222, 128, 0.6)",
            }} // Glow effect on hover
            whileTap={{ scale: 0.95 }} // Click animation
            aria-label="Go back to the home page" // Accessibility
          >
            Back to the Home Ground
          </MotionLink>
        </motion.div>

        {/* Footer message */}
        <motion.p
          className="mt-12 text-zinc-300 text-md italic"
          variants={itemVariants}
        >
          (Even legendary players take a wrong turn sometimes. Best of luck on
          your next innings!)
        </motion.p>
      </motion.div>
    </div>
  );
}
