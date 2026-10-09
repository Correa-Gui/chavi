import { LEAD_STATUS_AVATAR, type LeadStatus } from '@/lib/lead-status';
import { cn } from '@/lib/utils';

/** Duas iniciais do nome. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Avatar com iniciais na cor do status. Decorativo: o nome aparece em texto ao lado. */
export function Avatar({
  name,
  status,
  className,
}: {
  name: string;
  status: LeadStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full text-14 font-bold',
        LEAD_STATUS_AVATAR[status],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
