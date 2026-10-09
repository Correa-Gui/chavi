import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_PING, SYSTEM_PING_QUEUE } from './jobs/system-ping';
import { relayOutboxOnce, type RelayResult } from './outbox-relay';

/**
 * Dois "workers" (cada um com seu PgBoss, seu pool e seu relay) disputando a mesma outbox em
 * Postgres de verdade. Prova que `for update skip locked` + id do job impedem duplicidade:
 *  - cada linha vira exatamente 1 job e é marcada 1 vez;
 *  - cada job é processado exatamente 1 vez, mesmo com dois consumidores.
 *
 * Roda só com INTEGRATION_DATABASE_URL (o job de RLS do CI aponta para o Supabase local). Recusa
 * qualquer host que não seja localhost: nunca roda contra o chavi-dev. No CI,
 * REQUIRE_CONCURRENCY_TEST=1 transforma a ausência da URL em falha, para o teste não sumir calado.
 */

const url = process.env.INTEGRATION_DATABASE_URL;
if (process.env.REQUIRE_CONCURRENCY_TEST === '1' && !url) {
  throw new Error('REQUIRE_CONCURRENCY_TEST=1 exige INTEGRATION_DATABASE_URL.');
}
if (url && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('INTEGRATION_DATABASE_URL deve apontar para localhost (Supabase local do CI).');
}

// Tenant do seed.sql (Imobiliária Demo); o CI roda `supabase db reset` antes.
const TENANT = '00000000-0000-4000-a000-00000000000a';
const JOBS = 40;
const logger = pino({ level: 'silent' });
const schema = `pgboss_conc_${randomUUID().replaceAll('-', '').slice(0, 8)}`;

type Worker = { name: string; pool: Pool; boss: PgBoss };

async function startWorker(name: string, processed: string[]): Promise<Worker> {
  const pool = new Pool({ connectionString: url, max: 3 });
  const boss = new PgBoss({
    connectionString: url,
    schema,
    max: 4,
    supervise: false,
    schedule: false,
  });
  boss.on('error', () => undefined);
  await boss.start();
  await boss.createQueue(SYSTEM_PING, SYSTEM_PING_QUEUE);
  await boss.work(SYSTEM_PING, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async (jobs) => {
    for (const job of jobs) {
      processed.push(job.id);
      // Dá tempo de o outro worker disputar jobs.
      await new Promise((r) => setTimeout(r, 15));
    }
  });
  return { name, pool, boss };
}

async function drain(worker: Worker): Promise<RelayResult> {
  const total: RelayResult = { enqueued: 0, duplicates: 0, failed: 0 };
  for (let idle = 0; idle < 3;) {
    // Lotes pequenos para os dois relays alternarem nas mesmas linhas.
    const r = await relayOutboxOnce({ ...worker, logger, batchSize: 5 });
    total.enqueued += r.enqueued;
    total.duplicates += r.duplicates;
    total.failed += r.failed;
    idle = r.enqueued + r.duplicates + r.failed === 0 ? idle + 1 : 0;
  }
  return total;
}

describe.skipIf(!url)('dois workers concorrentes (Postgres real)', () => {
  const processed: string[] = [];
  const ids: string[] = [];
  let admin: Pool;
  let workers: Worker[] = [];

  beforeAll(async () => {
    admin = new Pool({ connectionString: url, max: 2 });
    for (let i = 0; i < JOBS; i++) {
      const { rows } = await admin.query<{ id: string }>(
        `insert into public.job_outbox (tenant_id, name, payload)
         values ($1, 'system.ping', $2) returning id`,
        [TENANT, JSON.stringify({ n: i })],
      );
      ids.push(rows[0]!.id);
    }
    workers = [await startWorker('a', processed), await startWorker('b', processed)];
  }, 60_000);

  afterAll(async () => {
    for (const w of workers) {
      await w.boss.stop({ graceful: false });
      await w.pool.end();
    }
    if (ids.length) await admin.query('delete from public.job_outbox where id = any($1)', [ids]);
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.end();
  }, 60_000);

  it('cada linha vira 1 job e cada job é processado 1 vez', async () => {
    const results = await Promise.all(workers.map(drain));

    // Relay: soma exata, sem duplicado nem falha.
    expect(results.reduce((n, r) => n + r.enqueued, 0)).toBe(JOBS);
    expect(results.reduce((n, r) => n + r.duplicates + r.failed, 0)).toBe(0);

    const { rows: outbox } = await admin.query<{ status: string; attempts: number }>(
      'select status, attempts from public.job_outbox where id = any($1)',
      [ids],
    );
    expect(outbox).toHaveLength(JOBS);
    expect(outbox.every((r) => r.status === 'enqueued' && r.attempts === 1)).toBe(true);

    // pg-boss: exatamente 1 job por linha da outbox.
    const { rows: jobs } = await admin.query<{ id: string }>(
      `select id from ${schema}.job where name = $1 and id = any($2)`,
      [SYSTEM_PING, ids],
    );
    expect(jobs.map((j) => j.id).sort()).toEqual([...ids].sort());

    // Consumo: espera os dois workers terminarem tudo e confere que ninguém repetiu job.
    const deadline = Date.now() + 40_000;
    while (processed.length < JOBS && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    // Margem para um eventual segundo processamento aparecer antes de afirmar.
    await new Promise((r) => setTimeout(r, 1500));
    expect(processed).toHaveLength(JOBS);
    expect(new Set(processed).size).toBe(JOBS);
    expect([...processed].sort()).toEqual([...ids].sort());
  }, 90_000);
});
