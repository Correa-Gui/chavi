import pino from 'pino';

/** Logs JSON estruturados. Sempre inclua tenantId e jobId; nunca telefone, e-mail ou renda completos. */
export function createLogger(level: string) {
  return pino({ level, base: { service: 'worker' } });
}
