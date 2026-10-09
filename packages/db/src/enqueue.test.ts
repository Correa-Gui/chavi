import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enqueue, JOB_NAMES } from './enqueue';
import type { ChaviClient } from './types';

const tenantId = '11111111-1111-4111-8111-111111111111';

/** Cliente falso: guarda o que foi inserido e devolve o erro configurado. */
function fakeClient(error: { message: string } | null = null) {
  const calls: { table: string; row: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      insert: (row: unknown) => {
        calls.push({ table, row });
        return Promise.resolve({ error });
      },
    }),
  } as unknown as ChaviClient;
  return { client, calls };
}

describe('enqueue', () => {
  it('insere na job_outbox com tenant_id explícito', async () => {
    const { client, calls } = fakeClient();
    const result = await enqueue(client, {
      tenantId,
      name: 'system.ping',
      payload: { failFirstAttempts: 1 },
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        table: 'job_outbox',
        row: { tenant_id: tenantId, name: 'system.ping', payload: { failFirstAttempts: 1 } },
      },
    ]);
  });

  it('converte runAfter para ISO', async () => {
    const { client, calls } = fakeClient();
    await enqueue(client, {
      tenantId,
      name: 'system.ping',
      runAfter: new Date('2026-10-10T12:00:00Z'),
    });
    expect(calls[0]?.row).toMatchObject({ run_after: '2026-10-10T12:00:00.000Z' });
  });

  it('recusa tenantId ausente ou inválido sem tocar no banco', async () => {
    const { client, calls } = fakeClient();
    // @ts-expect-error tenantId é obrigatório no tipo
    const missing = await enqueue(client, { name: 'system.ping' });
    const bad = await enqueue(client, { tenantId: 'nao-uuid', name: 'system.ping' });
    expect(missing).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(bad).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('recusa job fora da lista', async () => {
    const { client, calls } = fakeClient();
    // @ts-expect-error nome fora da lista fechada
    const result = await enqueue(client, { tenantId, name: 'outro.job' });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('devolve erro tipado quando o banco recusa (ex.: RLS), sem lançar', async () => {
    const { client } = fakeClient({ message: 'new row violates row-level security policy' });
    const result = await enqueue(client, { tenantId, name: 'system.ping' });
    expect(result).toEqual({
      ok: false,
      reason: 'database',
      message: 'new row violates row-level security policy',
    });
  });
});

describe('JOB_NAMES', () => {
  const dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../supabase/migrations',
  );
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  const names = (list: string | undefined) =>
    [...(list ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

  it('bate com os jobs que a policy job_outbox_insert deixa o usuário pedir', () => {
    // Última definição da policy (migrations futuras podem recriá-la).
    const policies = [...sql.matchAll(/create policy job_outbox_insert[\s\S]*?;/g)];
    const last = policies.at(-1)?.[0];
    expect(last).toBeDefined();
    const inPolicy = /and name in \(([^)]*)\)/.exec(last ?? '')?.[1];
    expect(inPolicy, 'a policy precisa restringir name').toBeDefined();
    expect(names(inPolicy)).toEqual([...JOB_NAMES].sort());
  });

  it('é um subconjunto da constraint job_outbox_name_allowed', () => {
    const constraints = [...sql.matchAll(/job_outbox_name_allowed check \(name in \(([^)]*)\)\)/g)];
    const inDb = names(constraints.at(-1)?.[1]);
    for (const name of JOB_NAMES) expect(inDb).toContain(name);
  });
});
