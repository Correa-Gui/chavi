import type { ReactNode } from 'react';

/** Estado vazio: diz o que falta e o que fazer a seguir. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-column px-6 py-12 text-center">
      <h3 className="font-display text-20 font-bold tracking-[-0.035em]">{title}</h3>
      <p className="max-w-sm text-14 text-ink-2">{description}</p>
      {action}
    </div>
  );
}
