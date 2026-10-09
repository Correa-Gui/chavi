import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

// Galeria de componentes só para desenvolvimento: em produção a rota não existe.
export default function DevUiLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AppShell aiActive>{children}</AppShell>;
}
