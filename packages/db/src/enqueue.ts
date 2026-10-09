import { z } from 'zod';
import type { Json } from './types.gen';
import type { ChaviClient } from './types';

/**
 * Jobs que a web pode pedir. Espelha a constraint `job_outbox_name_allowed` do banco: job novo
 * exige migration nova alterando a lista E uma entrada aqui (há um teste que confere os dois).
 */
export const JOB_NAMES = ['system.ping'] as const;
export type JobName = (typeof JOB_NAMES)[number];

const enqueueInputSchema = z.object({
  // tenantId é obrigatório e explícito (CLAUDE.md, regra 1 e arquitetura §4).
  tenantId: z.uuid(),
  name: z.enum(JOB_NAMES),
  payload: z.record(z.string(), z.json()).default({}),
  runAfter: z.date().optional(),
});

export type EnqueueInput = z.input<typeof enqueueInputSchema>;

export type EnqueueResult =
  { ok: true } | { ok: false; reason: 'invalid_input' | 'database'; message: string };

/**
 * Pede um job ao worker gravando na `job_outbox` (ADR-006). A web nunca fala com o pg-boss.
 *
 * Usa o cliente do usuário (RLS): a policy só deixa inserir no tenant em que o usuário é membro
 * ativo. O papel `authenticated` não lê a outbox, por isso não devolvemos o id da linha.
 * Erros esperados voltam como resultado tipado; a mensagem nunca inclui o payload.
 */
export async function enqueue(client: ChaviClient, input: EnqueueInput): Promise<EnqueueResult> {
  const parsed = enqueueInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, reason: 'invalid_input', message };
  }
  const { tenantId, name, payload, runAfter } = parsed.data;

  const { error } = await client.from('job_outbox').insert({
    tenant_id: tenantId,
    name,
    payload: payload as Json,
    ...(runAfter ? { run_after: runAfter.toISOString() } : {}),
  });
  if (error) {
    return { ok: false, reason: 'database', message: error.message };
  }
  return { ok: true };
}
