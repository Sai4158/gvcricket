/**
 * File overview:
 * Purpose: Shared motion variants for the home how-it-works experience.
 * Main exports: card, grid, and preview motion variants.
 * Major callers: HowItWorksSectionContent.
 * Side effects: none.
 * Read next: ./HowItWorksSectionContent.jsx
 */

export const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.08,
    },
  },
};

export const cardVariants = {
  hidden: () => ({
    opacity: 0,
    scale: 0.986,
    y: 18,
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.62,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const previewStaggerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.06,
      staggerChildren: 0.06,
    },
  },
};

export const previewItemVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const previewTitleVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

