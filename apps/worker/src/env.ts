import { z } from 'zod';

/** pg-boss precisa de sessão: conexão direta ou session pooler (5432). Nunca o pooler transacional (6543). ADR-006. */
const FORBIDDEN_POOLER_PORT = '6543';

const databaseUrl = z
  .string()
  .min(1)
  .refine((value) => URL.canParse(value), 'DATABASE_URL_DIRECT não é uma URL válida')
  .refine(
    (value) => !URL.canParse(value) || new URL(value).port !== FORBIDDEN_POOLER_PORT,
    'DATABASE_URL_DIRECT não pode usar a porta 6543 (pooler em modo transação). Use 5432.',
  );

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z
    .string()
    .startsWith('sb_secret_', 'SUPABASE_SECRET_KEY deve ser uma chave secret (sb_secret_...)'),
  DATABASE_URL_DIRECT: databaseUrl,
  /** Intervalo do relay da outbox. */
  OUTBOX_POLL_MS: z.coerce.number().int().min(200).max(60_000).default(2000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(
  source: Record<string, string | undefined> = process.env,
): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    // Só nomes de variáveis e motivos; nunca valores (podem ser segredos).
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas no worker:\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
