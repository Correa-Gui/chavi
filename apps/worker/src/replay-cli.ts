import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { z } from 'zod';
import { parseWorkerEnv } from './env';
import { replayOutbox, type ReplayTarget } from './replay';

// Uso:
//   pnpm jobs:replay --id <uuid da linha na job_outbox>
//   pnpm jobs:replay --failed [--tenant <uuid>]
const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    failed: { type: 'boolean', default: false },
    tenant: { type: 'string' },
  },
});

const uuid = z.uuid();
let target: ReplayTarget;
if (values.id && !values.failed) {
  target = { kind: 'id', id: uuid.parse(values.id) };
} else if (values.failed && !values.id) {
  target = {
    kind: 'failed',
    ...(values.tenant ? { tenantId: uuid.parse(values.tenant) } : {}),
  };
} else {
  console.error(
    'Uso: pnpm jobs:replay --id <uuid>  |  pnpm jobs:replay --failed [--tenant <uuid>]',
  );
  process.exit(2);
}

const env = parseWorkerEnv();
const pool = new Pool({
  connectionString: env.DATABASE_URL_DIRECT,
  application_name: 'chavi-jobs-replay',
  max: 1,
  connectionTimeoutMillis: 10_000,
});
try {
  const ids = await replayOutbox(pool, target);
  // Só ids de linha (não são dado pessoal) e a contagem.
  console.log(`${ids.length} linha(s) da outbox voltaram para pending.`);
  for (const id of ids) console.log(`- ${id}`);
} finally {
  await pool.end();
}
