import type { Job, PgBoss } from 'pg-boss';
import type { Logger } from 'pino';
import { z } from 'zod';

export const SYSTEM_PING = 'system.ping';

/**
 * Política de retry do job de exemplo: 3 retries com backoff exponencial (começa em 1 s).
 * Jobs reais da fila herdam o mesmo desenho (CLAUDE.md: jobs idempotentes, com retry).
 */
export const SYSTEM_PING_QUEUE = {
  retryLimit: 3,
  retryDelay: 1,
  retryBackoff: true,
  // Máximo de 1 min entre tentativas, para o backoff não crescer sem limite.
  retryDelayMax: 60,
} as const;

/** Formato do payload que o relay entrega ao job (ver outbox-relay.ts). */
const pingDataSchema = z.object({
  tenantId: z.uuid(),
  outboxId: z.uuid(),
  payload: z
    .object({
      /** Faz as N primeiras tentativas falharem; serve para provar retry (critério 0.8). */
      failFirstAttempts: z.number().int().min(0).max(10).default(0),
    })
    .default({ failFirstAttempts: 0 }),
});

export type PingData = z.infer<typeof pingDataSchema>;

export function createPingHandler(logger: Logger) {
  return async (jobs: Job<object>[]): Promise<void> => {
    for (const job of jobs) {
      const data = pingDataSchema.parse(job.data);
      const log = logger.child({ tenantId: data.tenantId, jobId: job.id, job: job.name });
      if (job.retryCount < data.payload.failFirstAttempts) {
        log.warn({ retryCount: job.retryCount }, 'system.ping falhou de propósito');
        throw new Error(`falha simulada na tentativa ${job.retryCount + 1}`);
      }
      log.info({ retryCount: job.retryCount }, 'system.ping ok');
    }
  };
}

export async function registerSystemPing(boss: PgBoss, logger: Logger): Promise<void> {
  await boss.createQueue(SYSTEM_PING, SYSTEM_PING_QUEUE);
  // Uma tentativa por vez: se uma falhar, o pg-boss reagenda só ela.
  await boss.work(SYSTEM_PING, { batchSize: 1 }, createPingHandler(logger));
}
