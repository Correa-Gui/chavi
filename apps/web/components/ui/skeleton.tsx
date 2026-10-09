import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Bloco de carregamento. Sem animação própria: com movimento reduzido fica estático. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(110deg,var(--color-column)_30%,var(--color-line)_50%,var(--color-column)_70%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}
