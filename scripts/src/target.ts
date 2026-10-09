import { z } from 'zod';

/**
 * Trava de segurança para seed e testes de RLS (ADR-008, ADR-010): só rodam contra o projeto
 * chavi-dev (SUPABASE_DEV_PROJECT_REF) ou, no CI, contra o Supabase local.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const targetEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_DEV_PROJECT_REF: z.string().optional(),
  CI: z.string().optional(),
});

export type TargetCheck = { ok: true; label: string } | { ok: false; reason: string };

export function checkDevTarget(source: Record<string, string | undefined>): TargetCheck {
  const parsed = targetEnvSchema.safeParse(source);
  if (!parsed.success) {
    return { ok: false, reason: 'SUPABASE_URL ausente ou inválida' };
  }
  const { SUPABASE_URL, SUPABASE_DEV_PROJECT_REF, CI } = parsed.data;
  const host = new URL(SUPABASE_URL).hostname;

  if (LOCAL_HOSTS.has(host)) {
    return CI === 'true'
      ? { ok: true, label: 'Supabase local (CI)' }
      : { ok: false, reason: 'Supabase local só é aceito no CI (CI=true)' };
  }

  if (!SUPABASE_DEV_PROJECT_REF) {
    return { ok: false, reason: 'SUPABASE_DEV_PROJECT_REF não definido' };
  }
  const expectedHost = `${SUPABASE_DEV_PROJECT_REF}.supabase.co`;
  if (host !== expectedHost) {
    return {
      ok: false,
      reason: `SUPABASE_URL aponta para "${host}", mas só "${expectedHost}" (chavi-dev) é permitido`,
    };
  }
  return { ok: true, label: `chavi-dev (${SUPABASE_DEV_PROJECT_REF})` };
}

export function assertDevTarget(source: Record<string, string | undefined> = process.env): string {
  const result = checkDevTarget(source);
  if (!result.ok) {
    throw new Error(`Recusado: ${result.reason}.`);
  }
  return result.label;
}
