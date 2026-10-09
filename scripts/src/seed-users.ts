import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SEED_TENANTS, SEED_USERS } from './seed-data';
import { assertDevTarget } from './target';

/**
 * pnpm db:seed — cria/atualiza os usuários de teste via API admin, com memberships e perfis.
 * Idempotente. Só roda contra o chavi-dev ou o Supabase local do CI (ADR-008, ADR-010).
 * Os tenants vêm de supabase/seed.sql.
 */

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'SUPABASE_SECRET_KEY inválida'),
  SEED_USER_PASSWORD: z.string().min(12, 'SEED_USER_PASSWORD precisa de 12+ caracteres'),
});

async function main() {
  const target = assertDevTarget();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const env = parsed.data;
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tenantIds = Object.values(SEED_TENANTS).map((t) => t.id);
  const { data: tenants, error: tenantsError } = await admin
    .from('tenants')
    .select('id')
    .in('id', tenantIds);
  if (tenantsError) throw tenantsError;
  if ((tenants ?? []).length !== tenantIds.length) {
    throw new Error('Tenants do seed não encontrados. Aplique supabase/seed.sql antes.');
  }

  for (const user of SEED_USERS) {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: env.SEED_USER_PASSWORD,
      email_confirm: true,
    });
    if (created.error) {
      // Já existe: sincroniza a senha para os testes conseguirem logar.
      const updated = await admin.auth.admin.updateUserById(user.id, {
        password: env.SEED_USER_PASSWORD,
        email_confirm: true,
      });
      if (updated.error) {
        throw new Error(`Falha ao criar/atualizar ${user.key}: ${updated.error.message}`);
      }
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({ user_id: user.id, full_name: user.fullName }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    const rows = user.memberships.map((m) => ({
      user_id: user.id,
      tenant_id: SEED_TENANTS[m.tenant].id,
      role: m.role,
      active: true,
    }));
    const { error: membershipError } = await admin
      .from('memberships')
      .upsert(rows, { onConflict: 'user_id,tenant_id' });
    if (membershipError) throw membershipError;
  }

  // Sem e-mail no log (CLAUDE.md): só a contagem.
  console.log(`db:seed ok em ${target}: ${SEED_USERS.length} usuários de teste.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
