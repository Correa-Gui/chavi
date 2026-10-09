import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Barra a troca acidental pela chave secret, que nunca pode ir para o browser.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith(
      'sb_publishable_',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY deve ser uma chave publishable (sb_publishable_...)',
    ),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/** Valida as variáveis públicas do web. A chave secret nunca é lida aqui (ver ADR-007). */
export function parseWebEnv(source: Record<string, string | undefined>): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas no web:\n- ${problems.join('\n- ')}`);
  }
  return result.data;
}
