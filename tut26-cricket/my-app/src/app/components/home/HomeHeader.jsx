"use client";

/**
 * File overview:
 * Purpose: Renders Home UI for the app's screens and flows.
 * Main exports: HomeHeader.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowRight, FaBars, FaTimes } from "react-icons/fa";
import PendingLink from "../shared/PendingLink";
import useHomeDesktopLiteMotion from "./useHomeDesktopLiteMotion";

export default function HomeHeader() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const useDesktopLiteMotion = useHomeDesktopLiteMotion();
  const simplifyMotion = prefersReducedMotion || useDesktopLiteMotion;
  const useLiteDrawerMotion = !prefersReducedMotion && useDesktopLiteMotion;
  const disableDrawerMotion = prefersReducedMotion;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const idleTimerRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const isHeaderHidden = simplifyMotion ? false : hidden;
  const closeMenu = () => setIsMenuOpen(false);
  const handleDrawerDragEnd = (_event, info) => {
    if (info.offset.x > 90 || info.velocity.x > 700) {
      closeMenu();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches);

    syncReducedMotion();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncReducedMotion);
      return () => mediaQuery.removeEventListener("change", syncReducedMotion);
    }

    mediaQuery.addListener(syncReducedMotion);
    return () => mediaQuery.removeListener(syncReducedMotion);
  }, []);

  useEffect(() => {
    if (simplifyMotion) {
      return undefined;
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    lastScrollTopRef.current = window.scrollY || window.pageYOffset || 0;

    const handleScroll = () => {
      const latest = window.scrollY || window.pageYOffset || 0;
      const previous = lastScrollTopRef.current;
      lastScrollTopRef.current = latest;

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
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearIdleTimer();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMenuOpen, simplifyMotion]);

  useEffect(() => {
    if (!isMenuOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isMenuOpen]);

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

  const handleFaqClick = (event) => {
    const element = document.getElementById("home-faq");
    closeMenu();

    if (element) {
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", "/#home-faq");
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
    { href: "/director", text: "Director Mode" },
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
    {
      href: "/#home-faq",
      text: "FAQ",
      onClick: handleFaqClick,
    },
  ];

  const drawerOverlayTransition = disableDrawerMotion
    ? { duration: 0 }
    : useLiteDrawerMotion
      ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
      : { duration: 0.32, ease: [0.22, 1, 0.36, 1] };
  const drawerPanelTransition = disableDrawerMotion
    ? { duration: 0 }
    : useLiteDrawerMotion
      ? { duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }
      : { duration: 0.42, ease: [0.16, 1, 0.3, 1] };
  const drawerOverlayClassName = disableDrawerMotion
    ? "bg-black/60"
    : useLiteDrawerMotion
      ? "bg-black/52 will-change-[opacity]"
      : "bg-black/42 backdrop-blur-[3px] will-change-[opacity]";
  const drawerPanelClassName = disableDrawerMotion
    ? "bg-zinc-950/96"
    : useLiteDrawerMotion
      ? "bg-zinc-950/96 will-change-transform transform-gpu"
      : "bg-zinc-950/84 backdrop-blur-2xl will-change-transform transform-gpu";
  const drawerDragProps =
    disableDrawerMotion || useLiteDrawerMotion
      ? {}
      : {
          drag: "x",
          dragDirectionLock: true,
          dragConstraints: { left: 0, right: 0 },
          dragElastic: { left: 0, right: 0.12 },
          onDragEnd: handleDrawerDragEnd,
        };

  const linkStyles =
    "press-feedback flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-[1.34rem] leading-tight font-light text-zinc-300 transition-all duration-200 hover:bg-white/6 hover:text-white active:bg-white/10 active:text-white sm:text-2xl";
  const featuredLinkStyles =
    "press-feedback flex w-full items-center justify-between gap-4 overflow-hidden rounded-[24px] border border-white/18 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] px-4 py-4 text-left text-[1.12rem] text-rose-50 shadow-[0_18px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/24 hover:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))] active:scale-[0.99] sm:text-[1.05rem]";

  const handleNavClick = (event, onClick) => {
    closeMenu();
    onClick?.(event);
  };

  const getPendingLabel = (text) => {
    if (text === "All Sessions") {
      return "Opening sessions...";
    }
    if (text === "Start Match") {
      return "Starting new game...";
    }
    if (text === "Director Mode") {
      return "Opening director mode...";
    }
    return "Opening...";
  };

  return (
    <>
      <header
        className={`pointer-events-none fixed top-0 left-0 right-0 z-60 flex justify-end px-4 pt-5 pb-4 font-sans transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:px-6 md:pt-8 md:pb-6 ${
          isHeaderHidden ? "translate-y-[-28px] opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <button
          onClick={() => setIsMenuOpen(true)}
          className={`relative inline-flex h-22 w-14 items-center justify-center overflow-hidden text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-opacity duration-200 ${
            isHeaderHidden
              ? "pointer-events-none opacity-0"
              : "pointer-events-auto opacity-100 active:scale-95"
          }`}
          aria-label="Open navigation menu"
        >
          <FaBars className="h-8 w-8" />
        </button>
      </header>
      <AnimatePresence initial={false}>
        {isMenuOpen && (
          <motion.div
            initial={disableDrawerMotion ? false : { opacity: 0 }}
            animate={disableDrawerMotion ? undefined : { opacity: 1 }}
            exit={disableDrawerMotion ? undefined : { opacity: 0 }}
            transition={drawerOverlayTransition}
            className={`pointer-events-auto fixed inset-0 z-80 ${drawerOverlayClassName}`}
            onClick={closeMenu}
          >
            <motion.div
              initial={
                disableDrawerMotion
                  ? false
                  : useLiteDrawerMotion
                    ? { x: 32, opacity: 1 }
                    : { x: "100%", opacity: 0.98 }
              }
              animate={disableDrawerMotion ? undefined : { x: 0, opacity: 1 }}
              exit={
                disableDrawerMotion
                  ? undefined
                  : useLiteDrawerMotion
                    ? { x: 24, opacity: 1 }
                    : { x: "100%", opacity: 0.98 }
              }
              transition={drawerPanelTransition}
              {...drawerDragProps}
              className={`pointer-events-auto fixed top-0 right-0 bottom-0 w-[min(84vw,22rem)] max-w-full px-5 py-6 sm:px-6 flex flex-col shadow-2xl border-l border-zinc-700/80 ${
                drawerPanelClassName
              }`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex justify-start mb-8">
                <button
                  type="button"
                  onClick={closeMenu}
                  className="pointer-events-auto p-2 transition-transform duration-150 active:scale-90"
                  aria-label="Close navigation menu"
                >
                  <FaTimes className="text-white h-8 w-8" />
                </button>
              </div>
              <nav className="flex grow flex-col items-start justify-start overflow-y-auto pl-1 pr-1 sm:pl-3">
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
                      <li
                        key={index}
                        className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          simplifyMotion ? "" : "translate-x-0 opacity-100"
                        }`}
                        style={
                          simplifyMotion
                            ? undefined
                            : { transitionDelay: `${Math.round(30 + 35 * index)}ms` }
                        }
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
                              className={
                                link.subtext ? featuredLinkStyles : linkStyles
                              }
                            >
                              <span>
                                <span className="block">{link.text}</span>
                                {link.subtext && (
                                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/78 sm:text-[11px] sm:tracking-[0.28em]">
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
                            <PendingLink
                              href={link.href}
                              pendingLabel={getPendingLabel(link.text)}
                              pendingClassName="pending-shimmer"
                              primeAudioOnClick={link.text === "All Sessions"}
                              onClick={(event) =>
                                handleNavClick(event, link.onClick)
                              }
                              className={
                                link.subtext ? featuredLinkStyles : linkStyles
                              }
                            >
                              <span className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1">
                                <span className="block">{link.text}</span>
                                {link.subtext && (
                                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-200/82 sm:text-[11px] sm:tracking-[0.28em]">
                                    {link.subtext}
                                  </span>
                                )}
                              </span>
                              {link.icon && <link.icon className="h-5 w-5" />}
                              {!link.icon && link.subtext && (
                                <FaArrowRight className="h-4 w-4 text-rose-300" />
                              )}
                            </PendingLink>
                          )
                        ) : (
                          <button
                            onClick={(event) =>
                              handleNavClick(event, link.onClick)
                            }
                            className={
                              link.subtext ? featuredLinkStyles : linkStyles
                            }
                          >
                            <span className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1">
                              <span className="block">{link.text}</span>
                              {link.subtext && (
                                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-200/82 sm:text-[11px] sm:tracking-[0.28em]">
                                  {link.subtext}
                                </span>
                              )}
                            </span>
                            {link.icon && <link.icon className="h-5 w-5" />}
                            {!link.icon && link.subtext && (
                              <FaArrowRight className="h-4 w-4 text-rose-300" />
                            )}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


