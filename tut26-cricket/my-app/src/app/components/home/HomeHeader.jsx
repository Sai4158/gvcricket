"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { FaArrowRight, FaBars, FaTimes } from "react-icons/fa";

export default function HomeHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.onChange((latest) => {
      const previous = scrollY.getPrevious();
      if (latest > previous && latest > 150 && !isMenuOpen) {
        setHidden(true);
      } else {
        setHidden(false);
      }
    });
  }, [isMenuOpen, scrollY]);

  const handleScrollToCommunity = () => {
    setIsMenuOpen(false);
    const element = document.getElementById("community-highlights");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinks = [
    { href: "/session/new", text: "Start Match", icon: FaArrowRight },
    { href: "/session", text: "View Past/Live Sessions" },
    { type: "divider" },
    { onClick: handleScrollToCommunity, text: "Community Highlights" },
    { href: "/rules", text: "Community Rules" },
  ];

  const linkStyles =
    "text-2xl font-light text-zinc-300 hover:text-white transition-colors duration-300 flex items-center gap-3";

  return (
    <motion.header
      variants={{
        visible: { y: 0, opacity: 1 },
        hidden: { y: "-150%", opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="pointer-events-none fixed top-0 left-0 right-0 z-50 p-6 flex justify-end md:hidden font-sans"
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
              onClick={(event) => event.stopPropagation()}
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
                            <span>{link.text}</span>
                            {link.icon && <link.icon className="h-5 w-5" />}
                          </Link>
                        ) : (
                          <button onClick={link.onClick} className={linkStyles}>
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
