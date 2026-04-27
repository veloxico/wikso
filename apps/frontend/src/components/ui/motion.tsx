'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// --- Fade-in entrance animation ---
export function FadeIn({
  className,
  delay = 0,
  duration = 0.4,
  children,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number; duration?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Staggered list container ---
export function StaggerContainer({
  className,
  staggerDelay = 0.06,
  children,
  ...props
}: HTMLMotionProps<'div'> & { staggerDelay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Staggered list item ---
export function StaggerItem({
  className,
  children,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Card with hover lift ---
export function MotionCard({
  className,
  children,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      className={cn('transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Scale on press ---
export function MotionPress({
  className,
  children,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
