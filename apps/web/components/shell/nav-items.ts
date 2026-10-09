export type NavIcon = 'leads' | 'funil' | 'configuracoes';

/** Dados puros (serializáveis): o componente client resolve o ícone pela chave. */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Contador laranja ao lado do rótulo (ex.: leads esperando). */
  badge?: number;
};

// Telas de leads e funil chegam na Fase 4; o menu já reflete a estrutura final.
export const NAV_ITEMS: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/funil', label: 'Funil', icon: 'funil' },
  { href: '/configuracoes', label: 'Configurações', icon: 'configuracoes' },
];
