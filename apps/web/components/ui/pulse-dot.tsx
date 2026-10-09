import { cn } from '@/lib/utils';

/** Ponto com anel pulsante. Só em itens que pedem ação ou indicam IA atendendo. */
export function PulseDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block size-2.5 rounded-full bg-accent animate-pulse-ring', className)}
    />
  );
}
