import { createClient } from '@supabase/supabase-js';
import { parseOrThrow, secretKey, supabaseUrl } from './keys';
import type { Database } from './types.gen';
import type { ChaviClient } from './types';

/**
 * Cliente com a chave secret: IGNORA RLS. Uso permitido só no worker, nos scripts e no módulo
 * de convite (ADR-007). Repositórios que o recebem exigem `tenantId` explícito em toda consulta.
 * O ESLint proíbe importar este módulo em apps/web.
 */
export function createSecretSupabase(config: { url: string; secretKey: string }): ChaviClient {
  if ('window' in globalThis) {
    throw new Error('Cliente com chave secret não pode ser criado no browser.');
  }
  return createClient<Database>(
    parseOrThrow(supabaseUrl, config.url, 'URL do Supabase'),
    parseOrThrow(secretKey, config.secretKey, 'Chave secret'),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
