import { Pool } from 'pg';
import { createBoss } from './boss';
import { parseWorkerEnv } from './env';
import { registerSystemPing } from './jobs/system-ping';
import { createLogger } from './logger';
import { startOutboxRelay } from './outbox-relay';

const env = parseWorkerEnv();
const logger = createLogger(env.LOG_LEVEL);

const boss = createBoss(env.DATABASE_URL_DIRECT, logger);
// Pool próprio do relay (transação de lote). Mesmo destino do pg-boss: session pooler, nunca 6543.
const pool = new Pool({
  connectionString: env.DATABASE_URL_DIRECT,
  application_name: 'chavi-worker-relay',
  max: 2,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (error) => logger.error({ err: error.message }, 'erro no pool do relay'));

await boss.start();
await registerSystemPing(boss, logger);
const relay = startOutboxRelay({ pool, boss, logger, intervalMs: env.OUTBOX_POLL_MS });
logger.info('worker iniciado');

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker encerrando');
  try {
    await relay.stop();
    // Espera os jobs ativos terminarem (até 30 s) antes de fechar a conexão.
    await boss.stop({ graceful: true, timeout: 30_000 });
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'falha ao encerrar',
    );
    process.exit(1);
  }
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
