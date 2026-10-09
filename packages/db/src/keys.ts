import { z } from 'zod';

/** Mesmas regras do env do web e do worker (ADR-013): o prefixo impede trocar uma chave pela outra. */
export const supabaseUrl = z.url();
export const publishableKey = z
  .string()
  .startsWith('sb_publishable_', 'Esperada uma chave publishable (sb_publishable_...)');
export const secretKey = z
  .string()
  .startsWith('sb_secret_', 'Esperada uma chave secret (sb_secret_...)');

/** Valida sem ecoar o valor recebido na mensagem de erro (pode ser segredo). */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `${label} inválida: ${result.error.issues[0]?.message ?? 'formato inesperado'}`,
    );
  }
  return result.data;
}
