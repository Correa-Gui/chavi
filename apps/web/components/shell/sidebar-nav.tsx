'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-items';

/** Itens do menu. Vertical no desktop, faixa rolável no celular. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-14 font-medium transition-colors duration-200',
                  active
                    ? 'bg-shell-raised text-surface'
                    : 'text-nav-text hover:bg-shell-raised hover:text-surface',
                )}
              >
                <Icon aria-hidden strokeWidth={2} className="size-[18px]" />
                <span>{label}</span>
                {badge ? (
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-mono text-12 font-medium text-ink">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
