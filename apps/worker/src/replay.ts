/** Só o que o replay usa do banco. `pg.Pool` e PGlite servem. */
export type ReplayDb = {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type ReplayTarget = { kind: 'id'; id: string } | { kind: 'failed'; tenantId?: string };

/**
 * Devolve linhas `failed` da outbox para `pending` (zera as tentativas e libera já). O relay as
 * pega no próximo ciclo; `last_error` fica até o relay conseguir enfileirar (aí é limpo).
 *
 * Só toca em linhas `failed`: linha `enqueued` já virou job no pg-boss, e reenfileirá-la seria
 * o duplicado que o `id` do job existe para impedir. Devolve os ids reenfileirados.
 */
export async function replayOutbox(db: ReplayDb, target: ReplayTarget): Promise<string[]> {
  const base = `update public.job_outbox
                   set status = 'pending', attempts = 0, run_after = now()
                 where status = 'failed'`;
  const { rows } =
    target.kind === 'id'
      ? await db.query(`${base} and id = $1 returning id`, [target.id])
      : target.tenantId
        ? await db.query(`${base} and tenant_id = $1 returning id`, [target.tenantId])
        : await db.query(`${base} returning id`);
  return (rows as { id: string }[]).map((r) => r.id);
}
