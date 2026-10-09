import { describe, expect, it } from 'vitest';
import { parseWorkerEnv } from './env';

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_chave-de-teste',
  DATABASE_URL_DIRECT:
    'postgresql://postgres.ref:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
};

describe('parseWorkerEnv', () => {
  it('aceita session pooler na porta 5432', () => {
    expect(parseWorkerEnv(valid).DATABASE_URL_DIRECT).toContain(':5432');
  });

  it('rejeita a porta 6543 (pooler transacional)', () => {
    const url = valid.DATABASE_URL_DIRECT.replace(':5432', ':6543');
    expect(() => parseWorkerEnv({ ...valid, DATABASE_URL_DIRECT: url })).toThrow(/6543/);
  });

  it('rejeita chave publishable no lugar da secret', () => {
    expect(() =>
      parseWorkerEnv({ ...valid, SUPABASE_SECRET_KEY: 'sb_publishable_chave-de-teste' }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it('não vaza valores de segredos na mensagem de erro', () => {
    try {
      parseWorkerEnv({
        ...valid,
        SUPABASE_SECRET_KEY: 'valor-secreto-errado',
        DATABASE_URL_DIRECT: 'nao-e-url',
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain('nao-e-url');
      expect(String(error)).not.toContain('valor-secreto-errado');
    }
  });
});
