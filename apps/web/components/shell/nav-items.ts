export type NavIcon = 'leads' | 'funil' | 'configuracoes';

/** Dados puros (serializáveis): o componente client resolve o ícone pela chave. */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Contador laranja ao lado do rótulo (ex.: leads esperando). */
  badge?: number;
  /** Página ainda não existe: o item aparece desativado com "em breve", sem link. */
  soon?: boolean;
};

// Telas de leads e funil chegam na Fase 4; o menu já reflete a estrutura final. Tire `soon`
// do item quando a página existir.
export const NAV_ITEMS: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: 'leads', soon: true },
  { href: '/funil', label: 'Funil', icon: 'funil', soon: true },
  { href: '/configuracoes', label: 'Configurações', icon: 'configuracoes', soon: true },
];
