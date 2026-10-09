import { parseWorkerEnv } from './env';
import { createLogger } from './logger';

// T1: só valida o ambiente e sobe o processo. pg-boss, relay da outbox e system.ping entram na T13.
const env = parseWorkerEnv();
const logger = createLogger(env.LOG_LEVEL);

logger.info('worker iniciado');

const shutdown = (signal: string) => {
  logger.info({ signal }, 'worker encerrando');
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Mantém o processo vivo até a T13 introduzir o loop do pg-boss.
setInterval(() => undefined, 60_000);
