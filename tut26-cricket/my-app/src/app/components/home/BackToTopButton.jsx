"use client";

import { FaArrowUp } from "react-icons/fa";

export default function BackToTopButton() {
  const handleBackToTop = () => {
    window.scrollTo(0, 0);
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleBackToTop}
      className="liquid-glass inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-sm text-zinc-200 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-white/20 hover:text-white"
      aria-label="Back to top"
    >
      <FaArrowUp className="text-sm" />
    </button>
  );
}
