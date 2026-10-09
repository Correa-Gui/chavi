import { cn } from '@/lib/utils';

/** "IA digitando": três pontos com opacidade alternada, 0,15 s de atraso entre eles. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="IA digitando" className={cn('inline-flex gap-1', className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-1.5 rounded-full bg-current animate-typing"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
