import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/lead-status';
import { cn } from '@/lib/utils';

/** Etiqueta de status: pílula com o texto. "Em triagem" ganha brilho animado. */
export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-12 font-semibold whitespace-nowrap',
        LEAD_STATUS_BADGE[status],
        status === 'triage' &&
          'animate-shimmer bg-[linear-gradient(110deg,var(--color-triage-bg)_30%,#ffffff_50%,var(--color-triage-bg)_70%)] bg-[length:200%_100%]',
        className,
      )}
    >
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}
