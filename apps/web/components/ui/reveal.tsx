'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

const EASE = [0.2, 0.7, 0.2, 1] as const;

/**
 * Entrada de cards e linhas: opacidade 0→1 e y 12→0 em 0,6 s.
 * `index` gera a cascata de 65 ms entre irmãos. Com movimento reduzido, aparece direto.
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.065 }}
    >
      {children}
    </motion.div>
  );
}
