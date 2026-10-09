import type { Job } from 'pg-boss';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createPingHandler } from './system-ping';

const logger = pino({ level: 'silent' });
const handler = createPingHandler(logger);

const ids = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  outboxId: '22222222-2222-4222-8222-222222222222',
};

function job(retryCount: number, payload: object = {}): Job<object> {
  return {
    id: 'job-1',
    name: 'system.ping',
    data: { ...ids, payload },
    retryCount,
  } as Job<object>;
}

describe('system.ping', () => {
  it('passa quando não pede falha', async () => {
    await expect(handler([job(0)])).resolves.toBeUndefined();
  });

  it('falha nas tentativas pedidas e passa depois', async () => {
    const payload = { failFirstAttempts: 1 };
    await expect(handler([job(0, payload)])).rejects.toThrow('falha simulada');
    await expect(handler([job(1, payload)])).resolves.toBeUndefined();
  });

  it('rejeita dados sem tenantId', async () => {
    const bad = { id: 'j', name: 'system.ping', data: {}, retryCount: 0 } as Job<object>;
    await expect(handler([bad])).rejects.toThrow();
  });
});
