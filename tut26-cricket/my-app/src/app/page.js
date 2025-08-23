/* src/app/page.js */
"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  FaUsers,
  FaPlusCircle,
  FaListAlt,
  FaCoins,
  FaPenSquare,
  FaEye,
  FaCheckCircle,
  FaBars,
  FaTimes,
} from "react-icons/fa";

// --- Header Component with Mobile Navigation ---
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.onChange((latest) => {
      const previous = scrollY.getPrevious();
      // Hide header when scrolling down past a threshold, but not if the menu is open
      if (latest > previous && latest > 150 && !isMenuOpen) {
        setHidden(true);
      } else {
        setHidden(false);
      }
    });
  }, [scrollY, isMenuOpen]);

  const handleScrollToCommunity = () => {
    setIsMenuOpen(false);
    const element = document.getElementById("community-highlights");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinks = [
    { href: "/session/new", text: "Start Match 🡢" },
    { href: "/session", text: "View Past/Live Sessions" },
    { type: "divider" },
    { onClick: handleScrollToCommunity, text: "Community Highlights" },
    { href: "/rules", text: "Community Rules" },
  ];

  const linkStyles =
    "text-2xl font-light text-zinc-300 hover:text-white transition-colors duration-300";

  return (
    <motion.header
      variants={{
        visible: { y: 0, opacity: 1 },
        hidden: { y: "-150%", opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-end md:hidden font-sans"
    >
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMenuOpen(true)}
        className="p-3 text-white"
        aria-label="Open navigation menu"
      >
        <FaBars className="h-8 w-8" />
      </motion.button>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ease: "easeInOut", duration: 0.4 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed top-0 right-0 bottom-0 w-4/5 max-w-xs bg-zinc-900/60 backdrop-blur-xl p-6 flex flex-col shadow-2xl border-l border-zinc-700/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-start mb-8">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2"
                  aria-label="Close navigation menu"
                >
                  <FaTimes className="text-white h-8 w-8" />
                </motion.button>
              </div>
              <nav className="flex flex-col items-start justify-center flex-grow pl-4">
                <ul className="space-y-6">
                  {navLinks.map((link, index) => {
                    if (link.type === "divider") {
                      return (
                        <li key={index} aria-hidden="true">
                          <hr className="border-white/30" />
                        </li>
                      );
                    }
                    return (
                      <motion.li
                        key={index}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.15 * (index + 1),
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                      >
                        {link.href ? (
                          <Link
                            href={link.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={linkStyles}
                          >
                            {link.text}
                          </Link>
                        ) : (
                          <button onClick={link.onClick} className={linkStyles}>
                            {link.text}
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// A section component that fades and slides in as it enters the viewport
const AnimatedSection = ({ children, className, id }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
    once: true,
  });

  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.6], [100, 0]);

  return (
    <motion.section
      id={id}
      ref={ref}
      style={{ opacity, y }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
};

// ✅ NEW: A dedicated component for embedding YouTube videos
const YouTubeVideoPlayer = ({ videoId, title }) => (
  <figure className="overflow-hidden rounded-3xl ring-1 ring-white/10 bg-zinc-900 shadow-lg shadow-black/40 flex flex-col group hover:ring-yellow-400/50 transition-all duration-300">
    <div className="aspect-video">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
      ></iframe>
    </div>
    <figcaption className="p-4 text-center font-medium text-zinc-300 group-hover:text-amber-300 transition-colors">
      {title}
    </figcaption>
  </figure>
);

export default function HomePage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  // ✅ NEW: Array of your YouTube video IDs
  const communityVideos = [
    { videoId: "FztXLCMn0SQ", title: "Highlight 1" },
    { videoId: "foHic_QfJuU", title: "Highlight 2" },
    { videoId: "xEeLV0M78b4", title: "Highlight 3" },
    { videoId: "LlJZ0WJteSU", title: "Highlight 4 (Short)" },
  ];

  return (
    <>
      <Header />
      <main className="bg-black text-zinc-200 font-sans">
        {/* --- Hero Section (This part remains unchanged) --- */}
        <section ref={heroRef} className="h-screen relative overflow-hidden">
          <motion.div
            style={{ scale: heroScale, opacity: heroOpacity }}
            className="sticky top-0 h-screen flex flex-col items-center justify-center text-center"
          >
            <div className="absolute inset-0 bg-black/70 z-10" />
            <video
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              poster="/Thumb1.png"
            >
              <source src="/videos/Cricket1.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="relative z-20 flex flex-col items-center px-4">
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
              >
                <Image
                  src="/gvLogo.png"
                  alt="GV Cricket logo"
                  width={140}
                  height={140}
                  priority
                  className="h-44 w-44 object-contain drop-shadow-[0_5px_35px_rgba(255,100,120,0.8)] rounded-full mb-6"
                />
              </motion.div>
              {/* ✅ UPDATED H1 with animated gradient and glow */}
              <motion.h1
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
                // We apply our animation and a drop-shadow for the glow
                className="
    animate-[animate-gradient_5s_linear_infinite] 
    bg-clip-text text-transparent 
    text-6xl md:text-8xl font-extrabold tracking-tight
    drop-shadow-[0_0_1rem_rgba(249,115,22,0.4)]
  "
                // The gradient is now defined here with a larger background size
                style={{
                  backgroundSize: "200% auto",
                  backgroundImage:
                    "linear-gradient(to right, #fde047, #fbcfe8, #fb923c, #fbcfe8, #fde047)",
                }}
              >
                The Home of GV Cricket.
              </motion.h1>
            </div>
          </motion.div>
        </section>

        {/* --- Post-Hero Content Wrapper (This part remains unchanged) --- */}
        <div className="relative z-10 bg-[linear-gradient(155deg,theme(colors.red.900)_0%,theme(colors.black)_40%)] py-24 md:py-32 px-5 space-y-24 md:space-y-40">
          <section className="w-full max-w-3xl mx-auto flex flex-col items-center gap-12 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                Built for the Community, by the Community.
              </h2>
              <p className="text-lg text-zinc-300 leading-relaxed">
                Make scoring simple, fast, and accessible to everyone in{" "}
                <strong className="text-white">real time.</strong>
              </p>
            </div>
            <div className="w-full max-w-md flex flex-col gap-5">
              {/* ✅ Button 1: Animated Gradient Background */}
              <Link
                href="/session/new"
                className="
      text-center py-4 rounded-2xl text-black text-2xl font-bold
      shadow-lg shadow-amber-900/40
      hover:scale-105 transition-all duration-300
      animate-[animate-gradient-slow_8s_ease-in-out_infinite]
    "
                style={{
                  backgroundSize: "200% auto",
                  // The gradient is repeated for a seamless loop
                  backgroundImage:
                    "linear-gradient(to right, #facc15, #f59e0b, #fb923c, #f59e0b, #facc15)",
                }}
              >
                Launch Umpire <br /> View
              </Link>

              {/* ✅ Button 2: Animated Gradient Background (Different Colors) */}
              <Link
                href="/session"
                className="
      text-center py-4 rounded-2xl text-black text-2xl font-bold
      shadow-lg shadow-amber-900/40
      hover:scale-105 transition-all duration-300
      animate-[animate-gradient-slow_8s_ease-in-out_infinite]
    "
                style={{
                  backgroundSize: "200% auto",
                  backgroundImage:
                    "linear-gradient(to right, #facc15, #d97706, #fde047, #d97706, #facc15)",
                }}
              >
                View Past/Live <br /> Sessions
              </Link>

              {/* ✅ Button 3: Solid Color with Breathing Glow Animation */}
              <Link
                href="/rules"
                className="
      text-center py-4 rounded-2xl bg-zinc-700 text-white/80 text-2xl font-bold
      ring-1 ring-zinc-600
      hover:scale-105 transition-all duration-300
      hover:bg-zinc-600 hover:text-white
      animate-[animate-glow_4s_ease-in-out_infinite]
    "
              >
                View All Rules!
              </Link>
            </div>
          </section>

          <AnimatedSection className="w-full max-w-6xl mx-auto overflow-hidden">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-12 space-y-12 ring-1 ring-white/10 shadow-2xl shadow-black/40">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300">
                  How This App Works 🏏
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-xl text-white">
                  Say goodbye to memorizing. <br /> <br /> This is a real time
                  scoring tool designed for these games, perfect for practice
                  matches, league play, or just having fun with friends.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaListAlt className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Session Dashboard
                  </h3>
                  <p className="text-gray">
                    Your central hub to see all past games, create new ones, or
                    jump back into a <b>unfinished</b> match with a secure
                    Umpire PIN.
                  </p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaPenSquare className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Live Umpire Scoring
                  </h3>
                  <p className="text-gray">
                    The umpire's cockpit. Score every ball with simple, color
                    coded buttons for runs, wides, dots, and outs.
                  </p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaEye className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Spectator View
                  </h3>
                  <p className="text-gray">
                    Share the live scoreboard! <br /> <br /> Perfect for friends
                    to follow along or for displaying the score on a big screen
                    during a game. <br /> <br /> You can instantly see if the
                    session is live or completed. live matches show a red pulse,
                    and finished ones show green.
                  </p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaPlusCircle className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    New Match Setup
                  </h3>
                  <p className="text-gray">
                    Start a game in seconds. Just enter a match name, add
                    players to Team A & B, and pick the number of overs.
                  </p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaCoins className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Animated Coin Toss
                  </h3>
                  <p className="text-gray">
                    To make it official! A fun coin flip animation decides who
                    bats first, then automatically starts the match.
                  </p>
                </div>
                <div className="bg-black/20 p-6 rounded-2xl ring-1 ring-white/10">
                  <FaCheckCircle className="mx-auto text-cyan-300 text-4xl mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Final Results
                  </h3>
                  <p className="text-gray">
                    Get an instant summary showing who won, the final scores,
                    and key stats. All games are saved in the cloud for you to
                    review later.
                  </p>
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection
            id="community-highlights"
            className="w-full max-w-6xl mx-auto flex flex-col items-center"
          >
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-16 text-center text-white">
              From the Community
            </h2>
            <p className="text-lg text-zinc-300 leading-relaxed text-center max-w-3xl mx-auto -mt-8 mb-16">
              It all started in 2022 with a few friends who loved the game.
              Today, it's a friendly league of over{" "}
              <strong className="text-white">50+ members</strong> who meet for
              fun, competitive cricket.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8 w-full">
              {communityVideos.map((video) => (
                <YouTubeVideoPlayer
                  key={video.videoId}
                  videoId={video.videoId}
                  title={video.title}
                />
              ))}
            </div>
          </AnimatedSection>

          <footer className="text-center pt-24 pb-12 border-t border-white/10">
            <p className="text-zinc-400">
              &copy; {new Date().getFullYear()} GV Cricket. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
