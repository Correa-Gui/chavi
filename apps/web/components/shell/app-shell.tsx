import type { ReactNode } from 'react';
import { PulseDot } from '@/components/ui/pulse-dot';
import { NAV_ITEMS, type NavItem } from './nav-items';
import { SidebarNav } from './sidebar-nav';

/**
 * Moldura escura com menu lateral e painel areia (docs/DESIGN.md).
 * No celular o menu vira uma faixa no topo e o painel ocupa a largura toda.
 */
export function AppShell({
  children,
  items = NAV_ITEMS,
  aiActive = false,
}: {
  children: ReactNode;
  items?: NavItem[];
  /** Mostra o card "IA atendendo agora" no rodapé do menu. */
  aiActive?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-shell text-surface md:flex-row">
      <aside className="flex flex-col gap-3 px-4 py-3 md:w-60 md:shrink-0 md:gap-8 md:p-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-sm bg-accent font-display text-19 font-extrabold tracking-[-0.035em] text-ink"
          >
            C
          </span>
          <span className="font-display text-20 font-bold tracking-[-0.035em]">Chavi</span>
        </div>
        <SidebarNav items={items} />
        {aiActive ? (
          <div className="mt-auto hidden items-center gap-3 rounded-lg bg-shell-raised p-3 md:flex">
            <PulseDot />
            <div>
              <p className="text-13 font-semibold">IA atendendo agora</p>
              <p className="text-12 text-nav-text">Triagem em andamento</p>
            </div>
          </div>
        ) : null}
      </aside>
      <main className="m-0 flex-1 bg-panel p-4 text-ink md:m-2.5 md:ml-0 md:rounded-3xl md:p-8">
        {children}
      </main>
    </div>
  );
}
