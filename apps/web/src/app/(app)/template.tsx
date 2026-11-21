'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { DURATION } from '@/lib/motion';

/**
 * Page transition: a template remounts on every navigation, so each page fades
 * and rises in. Transforms never move layout (no CLS), and `MotionConfig
 * reducedMotion="user"` drops the rise under prefers-reduced-motion, leaving a
 * plain fade.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.panel }}
    >
      {children}
    </motion.div>
  );
}
