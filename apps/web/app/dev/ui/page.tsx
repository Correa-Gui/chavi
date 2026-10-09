import { Button } from '@/components/ui/button';

export const metadata = { title: 'Componentes · Chavi' };

export default function DevUiPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-30 font-extrabold tracking-[-0.035em]">Componentes</h1>
      <div className="flex flex-wrap gap-3">
        <Button>Primário</Button>
        <Button variant="accent">Acento</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Discreto</Button>
      </div>
    </div>
  );
}
