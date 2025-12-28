import type { Variants } from "framer-motion";

/**
 * Framer Motion animation variants for the layer flow visualization
 */

// Layer card entrance animation
export const layerCardVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
    scale: 0.95,
  },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
      ease: "easeOut",
    },
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
};

// Status indicator pulse animation
export const statusPulseVariants: Variants = {
  pending: {
    scale: 1,
    opacity: 0.5,
  },
  processing: {
    scale: [1, 1.2, 1],
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  complete: {
    scale: [1, 1.3, 1],
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

// Flow line animation
export const flowLineVariants: Variants = {
  idle: {
    opacity: 0.2,
    pathLength: 0,
  },
  flowing: {
    opacity: [0.2, 1, 0.2],
    pathLength: [0, 1, 0],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  complete: {
    opacity: 1,
    pathLength: 1,
  },
};

// Data preview expand animation
export const dataPreviewVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
        ease: "easeOut",
      },
      opacity: {
        duration: 0.2,
        delay: 0.1,
      },
    },
  },
};

// Message animation
export const messageVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
};

// Stagger children animation
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Glow effect animation (for completed layers)
export const glowVariants: Variants = {
  idle: {
    boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)",
  },
  glow: {
    boxShadow: [
      "0 0 0 0 rgba(34, 197, 94, 0.4)",
      "0 0 0 10px rgba(34, 197, 94, 0)",
    ],
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};
