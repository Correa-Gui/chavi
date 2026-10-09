import { createBrowserClient } from '@supabase/ssr';
import { parseOrThrow, publishableKey, supabaseUrl } from './keys';
import type { Database } from './types.gen';
import type { ChaviClient } from './types';

/** Cliente para componentes client do Next. Sempre sujeito à RLS. */
export function createBrowserSupabase(config: {
  url: string;
  publishableKey: string;
}): ChaviClient {
  return createBrowserClient<Database>(
    parseOrThrow(supabaseUrl, config.url, 'URL do Supabase'),
    parseOrThrow(publishableKey, config.publishableKey, 'Chave publishable'),
  );
}
