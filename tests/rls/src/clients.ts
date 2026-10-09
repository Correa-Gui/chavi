import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { seedUser } from '@chavi/scripts/seed-data';
import { assertDevTarget } from '@chavi/scripts/target';
import { z } from 'zod';

/**
 * Clientes para os testes de RLS (ADR-008):
 *  - `asUser`: login por senha com a chave publishable. É o que um usuário real consegue fazer.
 *  - `adminClient`: chave secret, só para preparar/verificar/limpar. Nunca prova permissão.
 */

assertDevTarget();

const env = z
  .object({
    SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
    SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
    SEED_USER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const adminClient: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  noSession,
);

export function anonClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, noSession);
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login falhou para usuário de teste: ${error.message}`);
  return client;
}

const cache = new Map<string, SupabaseClient>();

/** Cliente logado como um usuário do seed (ex.: "corretor.demo"). */
export async function asUser(key: string): Promise<SupabaseClient> {
  const cached = cache.get(key);
  if (cached) return cached;
  const client = await signInWithPassword(seedUser(key).email, env.SEED_USER_PASSWORD);
  cache.set(key, client);
  return client;
}

export const testPassword = env.SEED_USER_PASSWORD;
