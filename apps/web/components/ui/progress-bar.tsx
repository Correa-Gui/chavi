import { cn } from '@/lib/utils';

/** Barra horizontal que cresce da esquerda (scaleX 0→1, 1,1 s). `value` de 0 a 100. */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-column', className)}
    >
      <div
        className="h-full origin-left rounded-full bg-accent animate-bar-grow"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
