import { describe, expect, it } from 'vitest';
import { parseWebEnv } from './env';

describe('parseWebEnv', () => {
  it('aceita variáveis válidas', () => {
    const env = parseWebEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_chave-de-teste',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('rejeita URL inválida', () => {
    expect(() =>
      parseWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'x',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a',
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejeita chave secret no lugar da publishable', () => {
    expect(() =>
      parseWebEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_a',
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
