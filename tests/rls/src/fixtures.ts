import { randomUUID } from 'node:crypto';
import { adminClient } from './clients';

/**
 * Dados temporários criados pelos testes, sempre com o marcador `rls-test` e removidos no fim.
 * Linhas de audit_log geradas pelos testes ficam (a tabela é só de inserção, por desenho).
 */

const createdUsers: string[] = [];
const createdTenants: string[] = [];
const createdOutbox: string[] = [];

export async function createTempTenant(): Promise<string> {
  const id = randomUUID();
  const { error } = await adminClient
    .from('tenants')
    .insert({ id, name: 'rls-test tenant', slug: `rls-test-${id.slice(0, 8)}` });
  if (error) throw error;
  createdTenants.push(id);
  return id;
}

export async function createTempUser(password: string): Promise<{ id: string; email: string }> {
  const email = `rls-test-${randomUUID().slice(0, 8)}@chavi.test`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser sem usuário');
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

export async function addMembership(userId: string, tenantId: string, role: string) {
  const { error } = await adminClient
    .from('memberships')
    .insert({ user_id: userId, tenant_id: tenantId, role });
  if (error) throw error;
}

export function trackOutbox(id: string) {
  createdOutbox.push(id);
}

export async function cleanup() {
  if (createdOutbox.length) {
    await adminClient.from('job_outbox').delete().in('id', createdOutbox.splice(0));
  }
  // Apagar o tenant leva junto as memberships (cascade, liberado pelo trigger).
  for (const id of createdTenants.splice(0)) {
    await adminClient.from('tenants').delete().eq('id', id);
  }
  for (const id of createdUsers.splice(0)) {
    await adminClient.auth.admin.deleteUser(id);
  }
}
