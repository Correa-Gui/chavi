/** Status do lead na interface. Sempre em palavras, nunca número (CLAUDE.md regra 8, ADR-005). */
export type LeadStatus = 'hot' | 'warm' | 'cold' | 'triage' | 'out';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  hot: 'Quente',
  warm: 'Morno',
  cold: 'Frio',
  triage: 'Em triagem',
  out: 'Fora do perfil',
};

// Classes completas (não montadas por string) para o Tailwind enxergá-las no build.
export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  hot: 'bg-hot-bg text-hot-fg',
  warm: 'bg-warm-bg text-warm-fg',
  cold: 'bg-cold-bg text-cold-fg',
  triage: 'bg-triage-bg text-triage-fg',
  out: 'bg-out-bg text-out-fg',
};

export const LEAD_STATUS_AVATAR: Record<LeadStatus, string> = {
  hot: 'bg-hot-avatar text-hot-fg',
  warm: 'bg-warm-avatar text-warm-fg',
  cold: 'bg-cold-avatar text-cold-fg',
  triage: 'bg-triage-avatar text-triage-fg',
  out: 'bg-out-avatar text-out-fg',
};
