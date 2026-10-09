import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initials } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/lead-status';

describe('StatusBadge', () => {
  it.each(Object.entries(LEAD_STATUS_LABEL) as [LeadStatus, string][])(
    'mostra "%s" em palavras, sem número',
    (status, label) => {
      const html = renderToStaticMarkup(<StatusBadge status={status} />);
      expect(html).toContain(label);
      expect(label).not.toMatch(/\d/);
    },
  );

  it('usa exatamente os cinco status do produto', () => {
    expect(Object.values(LEAD_STATUS_LABEL)).toEqual([
      'Quente',
      'Morno',
      'Frio',
      'Em triagem',
      'Fora do perfil',
    ]);
  });
});

describe('initials', () => {
  it('usa primeira e última palavra', () => {
    expect(initials('Carlos Henrique Lima')).toBe('CL');
    expect(initials('  mariana  ')).toBe('M');
    expect(initials('')).toBe('');
  });
});

describe('Button', () => {
  it('é <button type="button"> por padrão', () => {
    const html = renderToStaticMarkup(<Button>Salvar</Button>);
    expect(html).toMatch(/^<button[^>]*type="button"/);
  });
});
