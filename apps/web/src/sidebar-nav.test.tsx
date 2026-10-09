import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SidebarNav } from '@/components/shell/sidebar-nav';
import { NAV_ITEMS, type NavItem } from '@/components/shell/nav-items';

vi.mock('next/navigation', () => ({ usePathname: () => '/leads' }));

describe('SidebarNav', () => {
  it('itens sem página ficam desativados com "em breve", sem link', () => {
    const html = renderToStaticMarkup(<SidebarNav items={NAV_ITEMS} />);
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(NAV_ITEMS.length);
    expect(html.match(/em breve/g)).toHaveLength(NAV_ITEMS.length);
  });

  it('item com página vira link e marca a página atual', () => {
    const items: NavItem[] = [{ href: '/leads', label: 'Leads', icon: 'leads' }];
    const html = renderToStaticMarkup(<SidebarNav items={items} />);
    expect(html).toContain('href="/leads"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('em breve');
  });

  it('todo item do menu está marcado como "em breve" enquanto a página não existir', () => {
    // Quando criar app/(app)/leads etc., tire `soon` do item e ajuste este teste.
    expect(NAV_ITEMS.every((i) => i.soon)).toBe(true);
  });
});
