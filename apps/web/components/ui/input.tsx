import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Campo de texto. Sempre use com <label> associado (htmlFor/id). */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-column bg-surface px-3.5 text-15 text-ink placeholder:text-ink-3 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
