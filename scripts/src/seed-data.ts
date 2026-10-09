/**
 * Dados fixos do seed de desenvolvimento/CI. Os tenants também estão em supabase/seed.sql
 * (mesmos UUIDs). E-mails usam o domínio reservado `.test`: nenhum e-mail é enviado.
 */

export type SeedRole = 'admin' | 'gerente' | 'corretor' | 'financeiro';

export const SEED_TENANTS = {
  demo: { id: '00000000-0000-4000-a000-00000000000a', name: 'Imobiliária Demo' },
  teste: { id: '00000000-0000-4000-a000-00000000000b', name: 'Imobiliária Teste' },
} as const;

export type SeedTenantKey = keyof typeof SEED_TENANTS;

export interface SeedUser {
  key: string;
  id: string;
  email: string;
  fullName: string;
  memberships: { tenant: SeedTenantKey; role: SeedRole }[];
}

const ROLES: SeedRole[] = ['admin', 'gerente', 'corretor', 'financeiro'];
const TENANT_DIGIT: Record<SeedTenantKey, string> = { demo: 'a', teste: 'b' };
const ROLE_LABEL: Record<SeedRole, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  corretor: 'Corretor',
  financeiro: 'Financeiro',
};

const perTenantUsers: SeedUser[] = (Object.keys(SEED_TENANTS) as SeedTenantKey[]).flatMap(
  (tenant) =>
    ROLES.map((role, index) => ({
      key: `${role}.${tenant}`,
      id: `00000000-0000-4000-b00${TENANT_DIGIT[tenant]}-00000000000${index + 1}`,
      email: `${role}.${tenant}@chavi.test`,
      fullName: `${ROLE_LABEL[role]} ${SEED_TENANTS[tenant].name}`,
      memberships: [{ tenant, role }],
    })),
);

/** Usuário em dois tenants, para testar a seleção de imobiliária. */
const multiTenantUser: SeedUser = {
  key: 'multi',
  id: '00000000-0000-4000-b00c-000000000001',
  email: 'multi@chavi.test',
  fullName: 'Corretor Multi',
  memberships: [
    { tenant: 'demo', role: 'gerente' },
    { tenant: 'teste', role: 'corretor' },
  ],
};

export const SEED_USERS: SeedUser[] = [...perTenantUsers, multiTenantUser];

export function seedUser(key: string): SeedUser {
  const user = SEED_USERS.find((u) => u.key === key);
  if (!user) throw new Error(`Usuário de seed desconhecido: ${key}`);
  return user;
}
