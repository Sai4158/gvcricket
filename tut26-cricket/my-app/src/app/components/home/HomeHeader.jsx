"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { FaArrowRight, FaBars, FaTimes } from "react-icons/fa";

export default function HomeHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();
  const closeMenu = () => setIsMenuOpen(false);
  const handleDrawerDragEnd = (_event, info) => {
    if (info.offset.x > 90 || info.velocity.x > 700) {
      closeMenu();
    }
  };

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      const previous = scrollY.getPrevious();
      if (latest > previous && latest > 150 && !isMenuOpen) {
        setHidden(true);
      } else {
        setHidden(false);
      }
    });
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

  const navLinks = [
    { href: "/session/new", text: "Start Match", icon: FaArrowRight },
    { href: "/session", text: "All Sessions" },
    {
      href: "/#product-demo",
      text: "See It In Action",
      onClick: handleDemoClick,
    },
    { type: "divider" },
    { href: "/rules", text: "GV Community Custom Rule Sheet" },
    {
      href: "https://usacricket.org/what-is-cricket/",
      text: "Learn Cricket",
      external: true,
    },
  ];

  const linkStyles =
    "press-feedback flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-2xl font-light text-zinc-300 transition-all duration-200 hover:bg-white/6 hover:text-white active:bg-white/10 active:text-white";

  const handleNavClick = (event, onClick) => {
    closeMenu();
    onClick?.(event);
  };

  return (
    <motion.header
      variants={{
        visible: { y: 0, opacity: 1 },
        hidden: { y: "-150%", opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="pointer-events-none fixed top-0 left-0 right-0 z-50 px-6 pt-8 pb-6 flex justify-end md:hidden font-sans"
    >
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsMenuOpen(true)}
        className="pointer-events-auto p-3 text-white"
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
              transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.9 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.14 }}
              onDragEnd={handleDrawerDragEnd}
              className="pointer-events-auto fixed top-0 right-0 bottom-0 w-4/5 max-w-xs bg-zinc-900/60 backdrop-blur-xl p-6 flex flex-col shadow-2xl border-l border-zinc-700/80 will-change-transform"
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
                          link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => handleNavClick(event, link.onClick)}
                              className={linkStyles}
                            >
                              <span>{link.text}</span>
                              {link.icon && <link.icon className="h-5 w-5" />}
                            </a>
                          ) : (
                          <Link
                            href={link.href}
                            onClick={(event) => handleNavClick(event, link.onClick)}
                            className={linkStyles}
                          >
                            <span>{link.text}</span>
                            {link.icon && <link.icon className="h-5 w-5" />}
                          </Link>
                          )
                        ) : (
                          <button
                            onClick={(event) => handleNavClick(event, link.onClick)}
                            className={linkStyles}
                          >
                            <span>{link.text}</span>
                            {link.icon && <link.icon className="h-5 w-5" />}
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
