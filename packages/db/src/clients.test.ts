import { describe, expect, it } from 'vitest';
import { createServerSupabase } from './server';
import { createSecretSupabase } from './secret';

const url = 'https://example.supabase.co';
const cookies = { getAll: () => [], setAll: () => undefined };

describe('createSecretSupabase', () => {
  it('cria o cliente com chave secret', () => {
    expect(createSecretSupabase({ url, secretKey: 'sb_secret_teste' })).toBeDefined();
  });

  it('recusa chave publishable, sem ecoar o valor', () => {
    expect(() => createSecretSupabase({ url, secretKey: 'sb_publishable_valor-x' })).toThrow(
      /Chave secret inválida/,
    );
    expect(() => createSecretSupabase({ url, secretKey: 'sb_publishable_valor-x' })).not.toThrow(
      /valor-x/,
    );
  });
});

describe('createServerSupabase', () => {
  it('cria o cliente com chave publishable e cookies', () => {
    expect(
      createServerSupabase({ url, publishableKey: 'sb_publishable_teste', cookies }),
    ).toBeDefined();
  });

  it('recusa chave secret no cliente que roda a pedido do usuário', () => {
    expect(() => createServerSupabase({ url, publishableKey: 'sb_secret_teste', cookies })).toThrow(
      /Chave publishable inválida/,
    );
  });

  it('recusa URL inválida', () => {
    expect(() =>
      createServerSupabase({ url: 'nao-e-url', publishableKey: 'sb_publishable_teste', cookies }),
    ).toThrow(/URL do Supabase inválida/);
  });
});
