import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { fromPglite, PgBoss } from 'pg-boss';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_PING, registerSystemPing } from './jobs/system-ping';
import { relayOutboxOnce, type RelayPool } from './outbox-relay';

/**
 * Critério 0.8 (T15): web → job_outbox → relay → pg-boss, com falha na 1ª tentativa, retry com
 * sucesso e duplicado que não reenfileira. Roda em PGlite (Postgres real em WASM, suportado
 * pelo pg-boss), então não depende de Docker nem do chavi-dev. A tabela `job_outbox` vem da
 * própria migration: se o schema mudar, este teste acompanha.
 *
 * Limite conhecido: PGlite tem uma única conexão, então este teste não exercita concorrência
 * real entre duas instâncias do worker (`for update skip locked`).
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const logger = pino({ level: 'silent' });

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations',
);

function extract(sql: string, pattern: RegExp, what: string): string {
  const match = pattern.exec(sql);
  if (!match) throw new Error(`Não achei ${what} nas migrations`);
  return match[0];
}

function outboxDdl(): string {
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(migrationsDir, f), 'utf8'))
    .join('\n');
  return [
    extract(sql, /create type public\.job_outbox_status as enum \([^)]*\);/, 'o enum'),
    extract(sql, /create table public\.job_outbox \([\s\S]*?\n\);/, 'a tabela job_outbox'),
  ].join('\n');
}

let db: PGlite;
let boss: PgBoss;

// Uma única conexão: o "pool" devolve sempre o mesmo PGlite.
const pool: RelayPool = {
  connect: async () => ({
    query: (text, values) => db.query(text, values),
    release: () => undefined,
  }),
};

async function insertOutbox(payload: object): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.job_outbox (tenant_id, name, payload) values ($1, 'system.ping', $2) returning id`,
    [TENANT, JSON.stringify(payload)],
  );
  return rows[0]!.id;
}

async function outboxRow(id: string) {
  const { rows } = await db.query<{ status: string; attempts: number; enqueued_at: string | null }>(
    'select status, attempts, enqueued_at from public.job_outbox where id = $1',
    [id],
  );
  return rows[0]!;
}

/** Espera o job chegar ao estado final (completed/failed) ou estoura o tempo. */
async function waitForJob(id: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [job] = await boss.findJobs(SYSTEM_PING, { id });
    if (job && (job.state === 'completed' || job.state === 'failed')) return job;
    if (Date.now() > deadline) throw new Error(`job ${id} não terminou: estado ${job?.state}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function countJobs(id: string): Promise<number> {
  return (await boss.findJobs(SYSTEM_PING, { id })).length;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.tenants (id uuid primary key);
    insert into public.tenants (id) values ('${TENANT}');
  `);
  await db.exec(outboxDdl());

  boss = new PgBoss({
    db: fromPglite(db),
    backend: 'pglite',
    schema: 'pgboss',
    supervise: false,
    schedule: false,
  });
  await boss.start();
  await registerSystemPing(boss, logger, { pollingIntervalSeconds: 0.5 });
}, 60_000);

afterAll(async () => {
  await boss?.stop({ graceful: false, close: false });
  await db?.close();
});

describe('outbox → pg-boss', () => {
  it('system.ping falha na 1ª tentativa, faz retry e termina com sucesso', async () => {
    const id = await insertOutbox({ failFirstAttempts: 1 });

    const relayed = await relayOutboxOnce({ pool, boss, logger });
    expect(relayed).toEqual({ enqueued: 1, duplicates: 0, failed: 0 });
    expect(await outboxRow(id)).toMatchObject({ status: 'enqueued', attempts: 1 });

    const job = await waitForJob(id);
    expect(job.state).toBe('completed');
    expect(job.retryCount).toBe(1);
    expect(job.data).toMatchObject({ tenantId: TENANT, outboxId: id });
  }, 30_000);

  it('linha já enfileirada não é relida nem reenfileirada', async () => {
    const id = await insertOutbox({});
    expect(await relayOutboxOnce({ pool, boss, logger })).toMatchObject({ enqueued: 1 });
    expect(await relayOutboxOnce({ pool, boss, logger })).toEqual({
      enqueued: 0,
      duplicates: 0,
      failed: 0,
    });
    await waitForJob(id);
    expect(await countJobs(id)).toBe(1);
  }, 30_000);

  it('se a linha voltar a pending (ex.: queda antes de marcar), o pg-boss recusa o duplicado', async () => {
    const id = await insertOutbox({});
    await relayOutboxOnce({ pool, boss, logger });
    await waitForJob(id);

    await db.query(
      `update public.job_outbox set status = 'pending', enqueued_at = null where id = $1`,
      [id],
    );
    const again = await relayOutboxOnce({ pool, boss, logger });

    expect(again).toEqual({ enqueued: 0, duplicates: 1, failed: 0 });
    expect(await countJobs(id)).toBe(1);
    expect(await outboxRow(id)).toMatchObject({ status: 'enqueued' });
  }, 30_000);

  it('respeita run_after: linha agendada para o futuro fica pending', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.job_outbox (tenant_id, name, run_after)
       values ($1, 'system.ping', now() + interval '1 hour') returning id`,
      [TENANT],
    );
    const id = rows[0]!.id;
    expect(await relayOutboxOnce({ pool, boss, logger })).toEqual({
      enqueued: 0,
      duplicates: 0,
      failed: 0,
    });
    expect(await outboxRow(id)).toMatchObject({ status: 'pending', attempts: 0 });
  });
});
