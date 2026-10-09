'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const format = new Intl.NumberFormat('pt-BR');

/**
 * Número que conta de 0 ao valor em ~1,1 s (easing cúbico de saída).
 * O HTML renderizado no servidor já traz o valor final; com movimento reduzido nada anima.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduce) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (latest) => {
        node.textContent = format.format(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span ref={ref}>{format.format(value)}</span>;
}
