"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { FaArrowRight, FaBars, FaTimes } from "react-icons/fa";

export default function HomeHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();
  const idleTimerRef = useRef(null);
  const closeMenu = () => setIsMenuOpen(false);
  const handleDrawerDragEnd = (_event, info) => {
    if (info.offset.x > 90 || info.velocity.x > 700) {
      closeMenu();
    }
  };

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const unsubscribe = scrollY.on("change", (latest) => {
      const previous = scrollY.getPrevious() ?? 0;

      if (isMenuOpen) {
        clearIdleTimer();
        setHidden(false);
        return;
      }

      const delta = latest - previous;
      const movementThreshold = 10;
      const topThreshold = 76;
      const hideThreshold = 126;

      if (latest <= topThreshold) {
        clearIdleTimer();
        setHidden(false);
        return;
      }

      if (Math.abs(delta) < movementThreshold) {
        clearIdleTimer();
        idleTimerRef.current = window.setTimeout(() => {
          setHidden(false);
        }, 450);
        return;
      }

      clearIdleTimer();

      if (delta > 0 && latest > hideThreshold) {
        setHidden(true);
        idleTimerRef.current = window.setTimeout(() => {
          setHidden(false);
        }, 450);
      } else if (delta < 0) {
        setHidden(false);
      }
    });

    return () => {
      clearIdleTimer();
      unsubscribe();
    };
  }, [isMenuOpen, scrollY]);

  const handleDemoClick = (event) => {
    const element = document.getElementById("product-demo");
    closeMenu();

    if (element) {
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "/#product-demo");
    }
  };

  const handleLearnCricketClick = (event) => {
    const element = document.getElementById("learn-cricket");
    closeMenu();

    if (element) {
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "/#learn-cricket");
    }
  };

  const handleUpdatesClick = (event) => {
    const element = document.getElementById("updates");
    closeMenu();

    if (element) {
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "/#updates");
    }
  };

  const navLinks = [
    { href: "/session/new", text: "Start Match", icon: FaArrowRight },
    { href: "/session", text: "All Sessions" },
    { type: "divider" },
    {
      href: "/#updates",
      text: "GV Cricket 2.0",
      subtext: "Explore the latest updates",
      onClick: handleUpdatesClick,
    },
    { type: "divider" },
    { href: "/rules", text: "GV Community Custom Rule Sheet" },
    {
      href: "/#product-demo",
      text: "Watch Community Highlights",
      onClick: handleDemoClick,
    },
    { type: "divider" },
    {
      href: "/#learn-cricket",
      text: "Learn Cricket",
      onClick: handleLearnCricketClick,
    },
  ];

  const linkStyles =
    "press-feedback flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-[1.6rem] leading-tight font-light text-zinc-300 transition-all duration-200 hover:bg-white/6 hover:text-white active:bg-white/10 active:text-white sm:text-2xl";
  const featuredLinkStyles =
    "press-feedback flex w-full items-center justify-between gap-4 overflow-hidden rounded-[24px] border border-white/18 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] px-4 py-4 text-left text-rose-50 shadow-[0_18px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/24 hover:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))] active:scale-[0.99] sm:text-[1.05rem]";

  const handleNavClick = (event, onClick) => {
    closeMenu();
    onClick?.(event);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={hidden ? { opacity: 0, y: -28 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed top-0 left-0 right-0 z-60 flex justify-end px-4 pt-5 pb-4 font-sans md:px-6 md:pt-8 md:pb-6"
    >
      <motion.button
        animate={{
          y: hidden ? 0 : [0, -2, 0],
          scale: hidden ? 1 : [1, 1.02, 1],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMenuOpen(true)}
        className={`relative inline-flex h-22 w-14 items-center justify-center overflow-hidden text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-opacity duration-200 ${
          hidden ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
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
            transition={{ ease: "easeOut", duration: 0.28 }}
            className="pointer-events-auto fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onTap={closeMenu}
          >
            <motion.div
              initial={{ x: "100%", opacity: 0.9, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: "100%", opacity: 0.96, scale: 0.985 }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 34,
                mass: 0.9,
              }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.14 }}
              onDragEnd={handleDrawerDragEnd}
              className="pointer-events-auto fixed top-0 right-0 bottom-0 w-[min(84vw,22rem)] bg-zinc-900/72 backdrop-blur-xl px-5 py-6 sm:px-6 flex flex-col shadow-2xl border-l border-zinc-700/80 will-change-transform"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onTap={(event) => event.stopPropagation()}
            >
              <div className="flex justify-start mb-8">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9, rotate: -8 }}
                  whileHover={{ scale: 1.04 }}
                  onTap={closeMenu}
                  className="pointer-events-auto p-2"
                  aria-label="Close navigation menu"
                >
                  <FaTimes className="text-white h-8 w-8" />
                </motion.button>
              </div>
              <nav className="flex grow flex-col items-start justify-center pl-1 sm:pl-3">
                <ul className="w-full space-y-5 sm:space-y-6">
                  {navLinks.map((link, index) => {
                    if (link.type === "divider") {
                      return (
                        <li key={index} aria-hidden="true">
                          <hr className="mx-3 border-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0.05),rgba(255,255,255,0.28),rgba(255,255,255,0.05))]" />
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
                          link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) =>
                                handleNavClick(event, link.onClick)
                              }
                              className={link.subtext ? featuredLinkStyles : linkStyles}
                            >
                              <span>
                                <span className="block">{link.text}</span>
                                {link.subtext && (
                                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/78">
                                    {link.subtext}
                                  </span>
                                )}
                              </span>
                              {link.icon && <link.icon className="h-5 w-5" />}
                              {!link.icon && link.subtext && (
                                <FaArrowRight className="h-4 w-4 text-amber-200" />
                              )}
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              onClick={(event) =>
                                handleNavClick(event, link.onClick)
                              }
                              className={link.subtext ? featuredLinkStyles : linkStyles}
                            >
                              <motion.span
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <span className="block">{link.text}</span>
                                {link.subtext && (
                                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-200/82">
                                    {link.subtext}
                                  </span>
                                )}
                              </motion.span>
                              {link.icon && <link.icon className="h-5 w-5" />}
                              {!link.icon && link.subtext && (
                                <motion.span
                                  animate={{ x: [0, 3, 0] }}
                                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  <FaArrowRight className="h-4 w-4 text-rose-300" />
                                </motion.span>
                              )}
                            </Link>
                          )
                        ) : (
                          <button
                            onClick={(event) =>
                              handleNavClick(event, link.onClick)
                            }
                            className={link.subtext ? featuredLinkStyles : linkStyles}
                          >
                            <motion.span
                              whileHover={{ x: 4 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <span className="block">{link.text}</span>
                              {link.subtext && (
                                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-200/82">
                                  {link.subtext}
                                </span>
                              )}
                            </motion.span>
                            {link.icon && <link.icon className="h-5 w-5" />}
                            {!link.icon && link.subtext && (
                              <motion.span
                                animate={{ x: [0, 3, 0] }}
                                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <FaArrowRight className="h-4 w-4 text-rose-300" />
                              </motion.span>
                            )}
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
}
