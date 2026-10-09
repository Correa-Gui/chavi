import type { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';

/** Depois de tantas falhas ao enfileirar, a linha vira `failed` e para de ser tentada (ADR-006). */
export const MAX_RELAY_ATTEMPTS = 5;

type OutboxRow = {
  id: string;
  tenant_id: string;
  name: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/** Só o que o relay usa de uma conexão. `pg.Pool` serve; os testes usam PGlite. */
export type RelayClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
};
export type RelayPool = { connect(): Promise<RelayClient> };

export type RelayResult = { enqueued: number; duplicates: number; failed: number };

/**
 * Lê a `job_outbox` e entrega cada linha ao pg-boss (ADR-006).
 *
 * Tudo numa transação só por lote: `boss.send` roda na mesma conexão que atualiza a linha, então
 * "enfileirou" e "marcou como enfileirado" acontecem juntos ou nenhum acontece. Além disso o job
 * usa o id da outbox como id e como `singletonKey`: se mesmo assim a linha for relida, o pg-boss
 * recusa o duplicado (`send` devolve null) e a linha é só marcada como enfileirada.
 *
 * A outbox é lida entre tenants porque o relay é infraestrutura; cada job leva o `tenantId` da
 * linha explicitamente e o handler o usa em tudo que faz.
 */
export async function relayOutboxOnce(deps: {
  pool: RelayPool;
  boss: PgBoss;
  logger: Logger;
  batchSize?: number;
}): Promise<RelayResult> {
  const { pool, boss, logger, batchSize = 25 } = deps;
  const result: RelayResult = { enqueued: 0, duplicates: 0, failed: 0 };
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select id, tenant_id, name, payload, attempts
         from public.job_outbox
        where status = 'pending' and run_after <= now()
        order by created_at
        limit $1
        for update skip locked`,
      [batchSize],
    );
    for (const row of rows as OutboxRow[]) {
      await relayRow(client, boss, logger, row, result);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return result;
}

async function relayRow(
  client: RelayClient,
  boss: PgBoss,
  logger: Logger,
  row: OutboxRow,
  result: RelayResult,
): Promise<void> {
  const log = logger.child({ tenantId: row.tenant_id, outboxId: row.id, job: row.name });
  // Savepoint: uma linha ruim não derruba o lote inteiro.
  await client.query('savepoint relay_row');
  try {
    const jobId = await boss.send(
      row.name,
      { tenantId: row.tenant_id, outboxId: row.id, payload: row.payload },
      {
        id: row.id,
        singletonKey: row.id,
        db: { executeSql: (text, values) => client.query(text, values as unknown[]) },
      },
    );
    await client.query(
      `update public.job_outbox
          set status = 'enqueued', enqueued_at = now(), attempts = attempts + 1, last_error = null
        where id = $1`,
      [row.id],
    );
    if (jobId === null) {
      result.duplicates += 1;
      log.warn('job já existia no pg-boss; outbox marcada como enfileirada');
    } else {
      result.enqueued += 1;
      log.info({ jobId }, 'job enfileirado');
    }
  } catch (error) {
    await client.query('rollback to savepoint relay_row');
    const attempts = row.attempts + 1;
    const status = attempts >= MAX_RELAY_ATTEMPTS ? 'failed' : 'pending';
    // Mensagem truncada: pode vir de driver/banco e nunca deve carregar payload inteiro.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    await client.query(
      `update public.job_outbox
          set attempts = $2, last_error = $3, status = $4::public.job_outbox_status,
              run_after = now() + (least($2, 6) * interval '10 seconds')
        where id = $1`,
      [row.id, attempts, message, status],
    );
    result.failed += 1;
    log.error({ attempts, status, err: message }, 'falha ao enfileirar job da outbox');
  }
  await client.query('release savepoint relay_row');
}

/** Laço do relay: consulta a outbox a cada `intervalMs` até `stop()`. */
export function startOutboxRelay(deps: {
  pool: RelayPool;
  boss: PgBoss;
  logger: Logger;
  intervalMs: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();

  const tick = () => {
    running = (async () => {
      try {
        await relayOutboxOnce(deps);
      } catch (error) {
        deps.logger.error(
          { err: error instanceof Error ? error.message : String(error) },
          'relay da outbox falhou',
        );
      }
      if (!stopped) timer = setTimeout(tick, deps.intervalMs);
    })();
  };
  tick();

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running;
    },
  };
}
