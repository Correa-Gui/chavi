import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { PulseDot } from '@/components/ui/pulse-dot';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypingDots } from '@/components/ui/typing-dots';
import type { LeadStatus } from '@/lib/lead-status';

export const metadata = { title: 'Componentes · Chavi' };

const STATUSES: LeadStatus[] = ['hot', 'warm', 'cold', 'triage', 'out'];

// Dados fictícios só para a galeria.
const LEADS: { name: string; phone: string; status: LeadStatus }[] = [
  { name: 'Mariana Souza', phone: '(16) 99812-4410', status: 'hot' },
  { name: 'Carlos Henrique Lima', phone: '(16) 99701-2288', status: 'warm' },
  { name: 'Patrícia Alves', phone: '(16) 99644-0912', status: 'cold' },
  { name: 'Roberto Nunes', phone: '(16) 99533-7745', status: 'triage' },
  { name: 'Juliana Prado', phone: '(16) 99420-1180', status: 'out' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-20 font-bold tracking-[-0.035em]">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <header>
        <h1 className="font-display text-30 font-extrabold tracking-[-0.035em]">Componentes</h1>
        <p className="mt-1 text-14 text-ink-2">
          Galeria da direção Brasa. Existe só em desenvolvimento.
        </p>
      </header>

      <Section title="Números do dia">
        <div className="grid gap-3 sm:grid-cols-3">
          <Reveal index={0}>
            <KpiCard variant="dark" label="Quentes hoje" value={12} hint="3 a mais que ontem" />
          </Reveal>
          <Reveal index={1}>
            <KpiCard label="Em triagem" value={27} hint="IA conversando" />
          </Reveal>
          <Reveal index={2}>
            <KpiCard
              variant="alert"
              label="Esperando corretor"
              value={4}
              hint="Prazo do 1º contato"
            />
          </Reveal>
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="accent">Acento</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button size="sm">Pequeno</Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </Section>

      <Section title="Etiquetas de status">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Fila de leads">
        <Card className="flex flex-col divide-y divide-line p-2">
          {LEADS.map((lead, i) => (
            <Reveal key={lead.name} index={i} className="flex items-center gap-3 p-3">
              <Avatar name={lead.name} status={lead.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-15 font-semibold">{lead.name}</p>
                <p className="font-mono text-13 text-ink-3">{lead.phone}</p>
              </div>
              <StatusBadge status={lead.status} />
            </Reveal>
          ))}
        </Card>
      </Section>

      <Section title="Conversa">
        <div className="flex flex-col gap-2 rounded-xl bg-column p-4">
          <ChatBubble from="lead" time="14:02">
            Oi, vi o anúncio do apartamento. Ainda está disponível?
          </ChatBubble>
          <ChatBubble from="team" time="14:02">
            Olá! Sou a assistente virtual da imobiliária. Posso te fazer algumas perguntas rápidas?
          </ChatBubble>
          <div className="flex items-center gap-2 self-end text-ink-3">
            <span className="text-12">IA digitando</span>
            <TypingDots />
          </div>
        </div>
      </Section>

      <Section title="Campo, barra e pulso">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dev-nome" className="text-13 font-medium text-ink-2">
              Nome do lead
            </label>
            <Input id="dev-nome" placeholder="Ex.: Mariana Souza" />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <ProgressBar value={70} label="Triagem concluída" />
            <p className="flex items-center gap-2 text-13 text-ink-2">
              <PulseDot /> Pede ação do corretor
            </p>
          </div>
        </div>
      </Section>

      <Section title="Carregando e vazio">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10 w-2/3" />
          </div>
          <EmptyState
            title="Nenhum lead por aqui"
            description="Quando um lead entrar por qualquer origem, ele aparece nesta lista."
            action={<Button variant="secondary">Cadastrar lead</Button>}
          />
        </div>
      </Section>
    </div>
  );
}
