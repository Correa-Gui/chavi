import { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';

/** Schema do pg-boss: sem grants para anon/authenticated (ADR-006, migration de hardening). */
export const PGBOSS_SCHEMA = 'pgboss';

export function createBoss(connectionString: string, logger: Logger): PgBoss {
  const boss = new PgBoss({
    connectionString,
    schema: PGBOSS_SCHEMA,
    application_name: 'chavi-worker',
    // Poucas conexões: o session pooler do Supabase tem limite baixo no plano gratuito.
    max: 4,
    // Timeout explícito de conexão (regra de integrações).
    connectionTimeoutMillis: 10_000,
  });
  boss.on('error', (error) => {
    logger.error({ err: error.message }, 'erro no pg-boss');
  });
  return boss;
}
