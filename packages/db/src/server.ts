import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { parseOrThrow, publishableKey, supabaseUrl } from './keys';
import type { Database } from './types.gen';
import type { ChaviClient } from './types';

export type ServerCookies = CookieMethodsServer;

/**
 * Cliente para server components, server actions e route handlers. Usa a sessão do usuário
 * (cookies) com a chave publishable: sempre sujeito à RLS. Quem chama fornece os cookies
 * (em apps/web, a partir de `next/headers`), para este pacote não depender do Next.
 */
export function createServerSupabase(config: {
  url: string;
  publishableKey: string;
  cookies: ServerCookies;
}): ChaviClient {
  return createServerClient<Database>(
    parseOrThrow(supabaseUrl, config.url, 'URL do Supabase'),
    parseOrThrow(publishableKey, config.publishableKey, 'Chave publishable'),
    { cookies: config.cookies },
  );
}
