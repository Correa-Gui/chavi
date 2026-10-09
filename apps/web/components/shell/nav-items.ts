import { Columns3, Settings, Users, type LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Contador laranja ao lado do rótulo (ex.: leads esperando). */
  badge?: number;
};

// Telas de leads e funil chegam na Fase 4; o menu já reflete a estrutura final.
export const NAV_ITEMS: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/funil', label: 'Funil', icon: Columns3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];
