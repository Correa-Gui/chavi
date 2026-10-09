import { cn } from '@/lib/utils';
import { CountUp } from './count-up';

const variants = {
  default: 'bg-surface text-ink',
  // Escuro com brilho laranja desfocado ("Quentes hoje").
  dark: 'bg-shell text-surface',
  // Fundo de alerta ("Esperando corretor").
  alert: 'bg-sla-bg text-sla-fg',
} as const;

/** Card de número: rótulo, valor grande em Bricolage com contagem animada e legenda opcional. */
export function KpiCard({
  label,
  value,
  hint,
  variant = 'default',
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  variant?: keyof typeof variants;
  className?: string;
}) {
  const dark = variant === 'dark';
  return (
    <div className={cn('relative overflow-hidden rounded-xl p-5', variants[variant], className)}>
      {dark ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full bg-accent opacity-40 blur-3xl"
        />
      ) : null}
      <p className={cn('relative text-13 font-medium', dark ? 'text-nav-text' : 'text-ink-2')}>
        {label}
      </p>
      <p className="relative mt-2 font-display text-48 leading-none font-extrabold tracking-[-0.035em]">
        <CountUp value={value} />
      </p>
      {hint ? (
        <p className={cn('relative mt-2 text-12', dark ? 'text-nav-text' : 'text-ink-3')}>{hint}</p>
      ) : null}
    </div>
  );
}
