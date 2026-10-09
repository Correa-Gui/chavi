import type { PgBoss } from 'pg-boss';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { MAX_RELAY_ATTEMPTS, relayOutboxOnce, type RelayPool } from './outbox-relay';

const logger = pino({ level: 'silent' });

type Call = { text: string; values: unknown[] | undefined };

/** Pool falso: devolve as linhas pedidas no select e registra o resto das queries. */
function fakePool(rows: unknown[]) {
  const calls: Call[] = [];
  const pool: RelayPool = {
    connect: async () => ({
      query: async (text, values) => {
        calls.push({ text, values });
        return { rows: /^\s*select/i.test(text) ? rows : [] };
      },
      release: () => undefined,
    }),
  };
  return { pool, calls };
}

const row = (attempts: number) => ({
  id: '22222222-2222-4222-8222-222222222222',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  name: 'system.ping',
  payload: {},
  attempts,
});

const bossThat = (send: () => Promise<string | null>) => ({ send }) as unknown as PgBoss;

describe('relayOutboxOnce (falhas)', () => {
  it('erro ao enfileirar: guarda tentativa e erro, mantém pending e adia run_after', async () => {
    const { pool, calls } = fakePool([row(0)]);
    const boss = bossThat(async () => {
      throw new Error('queue does not exist');
    });

    const result = await relayOutboxOnce({ pool, boss, logger });

    expect(result).toEqual({ enqueued: 0, duplicates: 0, failed: 1 });
    const update = calls.find((c) => /set attempts/.test(c.text));
    expect(update?.values).toEqual([row(0).id, 1, 'queue does not exist', 'pending']);
    expect(calls.map((c) => c.text)).toContain('rollback to savepoint relay_row');
    expect(calls.at(-1)?.text).toBe('commit');
  });

  it('na última tentativa a linha vira failed', async () => {
    const { pool, calls } = fakePool([row(MAX_RELAY_ATTEMPTS - 1)]);
    const boss = bossThat(async () => {
      throw new Error('boom');
    });

    await relayOutboxOnce({ pool, boss, logger });

    const update = calls.find((c) => /set attempts/.test(c.text));
    expect(update?.values?.[1]).toBe(MAX_RELAY_ATTEMPTS);
    expect(update?.values?.[3]).toBe('failed');
  });

  it('send devolvendo null (duplicado) marca como enfileirada e conta duplicado', async () => {
    const { pool, calls } = fakePool([row(0)]);
    const result = await relayOutboxOnce({ pool, boss: bossThat(async () => null), logger });

    expect(result).toEqual({ enqueued: 0, duplicates: 1, failed: 0 });
    expect(calls.some((c) => /set status = 'enqueued'/.test(c.text))).toBe(true);
  });
});
