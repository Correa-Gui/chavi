import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Card branco (raio 20). `lift` adiciona o hover do DESIGN.md: sobe 3 px com sombra suave. */
export function Card({
  className,
  lift = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { lift?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface p-5',
        lift &&
          'transition duration-200 hover:-translate-y-[3px] hover:shadow-[0_12px_28px_-12px_rgb(20_22_28/0.25)]',
        className,
      )}
      {...props}
    />
  );
}
