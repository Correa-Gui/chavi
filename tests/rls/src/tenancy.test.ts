import { afterAll, describe, expect, it } from 'vitest';
import { SEED_TENANTS, SEED_USERS, seedUser, type SeedUser } from '@chavi/scripts/seed-data';
import { adminClient, anonClient, asUser, signInWithPassword, testPassword } from './clients';
import { addMembership, cleanup, createTempTenant, createTempUser, trackOutbox } from './fixtures';

/**
 * Critérios 0.3, 0.4 e 0.5 de docs/VALIDATION.md + ajustes E do plano da Fase 0.
 * Toda tentativa é feita com um cliente de usuário real (chave publishable + login).
 * A verificação do estado do banco é feita com o cliente admin.
 */

const A = SEED_TENANTS.demo.id;
const B = SEED_TENANTS.teste.id;

const singleTenantUsers = SEED_USERS.filter((u) => u.memberships.length === 1);
const tenantOf = (u: SeedUser) => SEED_TENANTS[u.memberships[0]!.tenant].id;
const otherTenant = (tenantId: string) => (tenantId === A ? B : A);

/** Usuários que têm membership no tenant (inclui o multi-tenant). */
function teamOf(tenantId: string): Set<string> {
  return new Set(
    SEED_USERS.filter((u) => u.memberships.some((m) => SEED_TENANTS[m.tenant].id === tenantId)).map(
      (u) => u.id,
    ),
  );
}

async function membershipOf(userId: string, tenantId: string) {
  const { data, error } = await adminClient
    .from('memberships')
    .select('role, active')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function tenantName(id: string) {
  const { data, error } = await adminClient.from('tenants').select('name').eq('id', id).single();
  if (error) throw error;
  return data.name as string;
}

afterAll(cleanup);

describe('0.3 · leitura isolada por tenant', () => {
  it.each(singleTenantUsers.map((u) => [u.key, u] as const))(
    '%s só lê o próprio tenant em todas as tabelas',
    async (_key, user) => {
      const own = tenantOf(user);
      const client = await asUser(user.key);

      const tenants = await client.from('tenants').select('id');
      expect(tenants.error).toBeNull();
      expect(tenants.data!.map((t) => t.id)).toEqual([own]);

      const memberships = await client.from('memberships').select('tenant_id');
      expect(memberships.error).toBeNull();
      expect(memberships.data!.length).toBeGreaterThan(0);
      expect(memberships.data!.every((m) => m.tenant_id === own)).toBe(true);

      const team = teamOf(own);
      const profiles = await client.from('profiles').select('user_id');
      expect(profiles.error).toBeNull();
      expect(profiles.data!.every((p) => team.has(p.user_id))).toBe(true);

      const audit = await client.from('audit_log').select('tenant_id');
      expect(audit.error).toBeNull();
      expect(audit.data!.every((r) => r.tenant_id === own)).toBe(true);

      const other = await client.from('tenants').select('id').eq('id', otherTenant(own));
      expect(other.data).toEqual([]);

      // job_outbox não tem leitura para usuários.
      const outbox = await client.from('job_outbox').select('id');
      expect(outbox.data ?? []).toEqual([]);
    },
  );

  it('usuário em dois tenants vê os dois, e nada além', async () => {
    const client = await asUser('multi');
    const { data } = await client.from('tenants').select('id').order('id');
    expect(data!.map((t) => t.id)).toEqual([A, B].sort());
  });

  it('só admin lê audit_log', async () => {
    for (const key of ['gerente.demo', 'corretor.demo', 'financeiro.demo']) {
      const { data } = await (await asUser(key)).from('audit_log').select('id');
      expect(data ?? []).toEqual([]);
    }
    const { data } = await (await asUser('admin.demo')).from('audit_log').select('id').limit(1);
    expect(data!.length).toBe(1); // o seed já gerou registros de memberships
  });
});

describe('0.3 · escrita bloqueada entre tenants', () => {
  it('admin de A não renomeia o tenant B', async () => {
    const before = await tenantName(B);
    const client = await asUser('admin.demo');
    await client.from('tenants').update({ name: 'invadido' }).eq('id', B);
    expect(await tenantName(B)).toBe(before);
  });

  it('admin de A não altera nem remove memberships de B', async () => {
    const client = await asUser('admin.demo');
    const target = seedUser('corretor.teste');

    await client
      .from('memberships')
      .update({ role: 'admin' })
      .eq('user_id', target.id)
      .eq('tenant_id', B);
    await client.from('memberships').delete().eq('user_id', target.id).eq('tenant_id', B);

    expect(await membershipOf(target.id, B)).toEqual({ role: 'corretor', active: true });
  });

  it('admin não move membership para outro tenant (tenant_id não é editável)', async () => {
    const client = await asUser('admin.demo');
    const target = seedUser('corretor.demo');
    const { error } = await client
      .from('memberships')
      .update({ tenant_id: B })
      .eq('user_id', target.id)
      .eq('tenant_id', A);
    expect(error).not.toBeNull();
    expect(await membershipOf(target.id, A)).not.toBeNull();
    expect(await membershipOf(target.id, B)).toBeNull();
  });

  it('usuário não edita perfil de outra pessoa', async () => {
    const victim = seedUser('corretor.teste');
    const { data: before } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', victim.id)
      .single();

    for (const key of ['corretor.demo', 'admin.demo', 'gerente.teste']) {
      await (
        await asUser(key)
      )
        .from('profiles')
        .update({ full_name: 'invadido' })
        .eq('user_id', victim.id);
    }

    const { data: after } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', victim.id)
      .single();
    expect(after).toEqual(before);
  });

  it('ninguém enfileira job em outro tenant', async () => {
    const client = await asUser('admin.demo');
    const { error } = await client.from('job_outbox').insert({ tenant_id: B, name: 'system.ping' });
    expect(error).not.toBeNull();
  });
});

describe('0.4 · sem membership ativa não lê nada', () => {
  it('usuário logado sem membership não vê nenhum dado', async () => {
    const temp = await createTempUser(testPassword);
    const client = await signInWithPassword(temp.email, testPassword);

    for (const table of ['tenants', 'memberships', 'profiles', 'audit_log'] as const) {
      const { data } = await client.from(table).select('*');
      expect(data ?? [], table).toEqual([]);
    }
    const { error } = await client.from('job_outbox').insert({ tenant_id: A, name: 'system.ping' });
    expect(error).not.toBeNull();
  });

  it('visitante sem login (chave publishable) não lê nada', async () => {
    const client = anonClient();
    for (const table of [
      'tenants',
      'memberships',
      'profiles',
      'audit_log',
      'job_outbox',
    ] as const) {
      const { data } = await client.from(table).select('*');
      expect(data ?? [], table).toEqual([]);
    }
  });

  it('membership desativada perde o acesso na hora', async () => {
    const temp = await createTempUser(testPassword);
    await addMembership(temp.id, A, 'corretor');
    const client = await signInWithPassword(temp.email, testPassword);

    const before = await client.from('tenants').select('id');
    expect(before.data!.map((t) => t.id)).toEqual([A]);

    const { error } = await adminClient
      .from('memberships')
      .update({ active: false })
      .eq('user_id', temp.id)
      .eq('tenant_id', A);
    expect(error).toBeNull();

    const after = await client.from('tenants').select('id');
    expect(after.data ?? []).toEqual([]);
  });
});

describe('0.5 · papéis', () => {
  it.each(['gerente.demo', 'corretor.demo', 'financeiro.demo'])(
    '%s não altera o próprio papel',
    async (key) => {
      const user = seedUser(key);
      const before = await membershipOf(user.id, A);
      await (
        await asUser(key)
      )
        .from('memberships')
        .update({ role: 'admin' })
        .eq('user_id', user.id);
      expect(await membershipOf(user.id, A)).toEqual(before);
    },
  );

  it('gerente não altera o papel de outra pessoa', async () => {
    const target = seedUser('corretor.demo');
    await (
      await asUser('gerente.demo')
    )
      .from('memberships')
      .update({ role: 'gerente' })
      .eq('user_id', target.id)
      .eq('tenant_id', A);
    expect(await membershipOf(target.id, A)).toEqual({ role: 'corretor', active: true });
  });

  it('admin altera o papel de alguém do próprio tenant, e isso vai para audit_log', async () => {
    const target = seedUser('corretor.demo');
    const client = await asUser('admin.demo');

    const changed = await client
      .from('memberships')
      .update({ role: 'gerente' })
      .eq('user_id', target.id)
      .eq('tenant_id', A)
      .select('role');
    expect(changed.error).toBeNull();
    expect(changed.data).toEqual([{ role: 'gerente' }]);

    const { data: audit } = await client
      .from('audit_log')
      .select('actor_id, entity, entity_id, action, after')
      .eq('entity_id', target.id)
      .eq('action', 'update')
      .order('at', { ascending: false })
      .limit(1)
      .single();
    expect(audit).toMatchObject({
      actor_id: seedUser('admin.demo').id,
      entity: 'memberships',
      action: 'update',
      after: { role: 'gerente' },
    });

    const reverted = await client
      .from('memberships')
      .update({ role: 'corretor' })
      .eq('user_id', target.id)
      .eq('tenant_id', A);
    expect(reverted.error).toBeNull();
    expect(await membershipOf(target.id, A)).toEqual({ role: 'corretor', active: true });
  });
});

describe('memberships · ninguém se insere em tenant', () => {
  it.each(['admin.demo', 'gerente.demo', 'corretor.demo', 'financeiro.demo'])(
    '%s não se insere no outro tenant nem no próprio',
    async (key) => {
      const user = seedUser(key);
      const client = await asUser(key);
      const intoOther = await client
        .from('memberships')
        .insert({ user_id: user.id, tenant_id: B, role: 'admin' });
      expect(intoOther.error).not.toBeNull();
      expect(await membershipOf(user.id, B)).toBeNull();
    },
  );

  it('admin não cria membership direto, nem no próprio tenant (só por convite)', async () => {
    const temp = await createTempUser(testPassword);
    const { error } = await (
      await asUser('admin.demo')
    )
      .from('memberships')
      .insert({ user_id: temp.id, tenant_id: A, role: 'corretor' });
    expect(error).not.toBeNull();
    expect(await membershipOf(temp.id, A)).toBeNull();
  });
});

describe('memberships · último admin', () => {
  const admin = seedUser('admin.demo');

  it('o último admin não pode se rebaixar, se desativar nem se remover', async () => {
    const client = await asUser('admin.demo');

    const demote = await client
      .from('memberships')
      .update({ role: 'gerente' })
      .eq('user_id', admin.id)
      .eq('tenant_id', A);
    expect(demote.error).not.toBeNull();

    const deactivate = await client
      .from('memberships')
      .update({ active: false })
      .eq('user_id', admin.id)
      .eq('tenant_id', A);
    expect(deactivate.error).not.toBeNull();

    const remove = await client
      .from('memberships')
      .delete()
      .eq('user_id', admin.id)
      .eq('tenant_id', A);
    expect(remove.error).not.toBeNull();

    expect(await membershipOf(admin.id, A)).toEqual({ role: 'admin', active: true });
  });

  it('nem a chave secret rebaixa o último admin', async () => {
    const target = seedUser('admin.teste');
    const { error } = await adminClient
      .from('memberships')
      .update({ role: 'corretor' })
      .eq('user_id', target.id)
      .eq('tenant_id', B);
    expect(error).not.toBeNull();
    expect(await membershipOf(target.id, B)).toEqual({ role: 'admin', active: true });
  });

  it('apagar o tenant inteiro com a chave secret funciona (cascade liberado)', async () => {
    const tenantId = await createTempTenant();
    const owner = await createTempUser(testPassword);
    await addMembership(owner.id, tenantId, 'admin');

    const { error } = await adminClient.from('tenants').delete().eq('id', tenantId);
    expect(error).toBeNull();

    const { data: tenant } = await adminClient.from('tenants').select('id').eq('id', tenantId);
    expect(tenant).toEqual([]);
    expect(await membershipOf(owner.id, tenantId)).toBeNull();
  });
});

describe('audit_log · histórico e dados pessoais (ADR-015)', () => {
  it('o histórico continua existindo depois que o tenant é apagado', async () => {
    const tenantId = await createTempTenant();
    const owner = await createTempUser(testPassword);
    await addMembership(owner.id, tenantId, 'admin');

    const { error } = await adminClient.from('tenants').delete().eq('id', tenantId);
    expect(error).toBeNull();

    const { data: history } = await adminClient
      .from('audit_log')
      .select('entity, entity_id, action, before, after')
      .eq('tenant_id', tenantId)
      .order('id');
    expect(history).toEqual([
      {
        entity: 'memberships',
        entity_id: owner.id,
        action: 'insert',
        before: null,
        after: { role: 'admin', active: true },
      },
      {
        entity: 'tenants',
        entity_id: tenantId,
        action: 'delete',
        before: expect.objectContaining({ slug: expect.stringMatching(/^rls-test-/) }),
        after: null,
      },
      {
        entity: 'memberships',
        entity_id: owner.id,
        action: 'delete',
        before: { role: 'admin', active: true },
        after: null,
      },
    ]);
  });

  it('nem a chave secret grava dado pessoal em before/after', async () => {
    for (const payload of [{ email: 'x@exemplo.com' }, { phone_e164: '+5516998124410' }]) {
      const { error } = await adminClient.from('audit_log').insert({
        tenant_id: A,
        entity: 'leads',
        entity_id: 'rls-test',
        action: 'update',
        after: payload,
      });
      expect(error, JSON.stringify(Object.keys(payload))).not.toBeNull();
    }
  });

  it('nem a chave secret apaga ou altera o histórico', async () => {
    const { data: row } = await adminClient.from('audit_log').select('id').limit(1).single();
    const del = await adminClient.from('audit_log').delete().eq('id', row!.id);
    const upd = await adminClient.from('audit_log').update({ action: 'delete' }).eq('id', row!.id);
    expect(del.error).not.toBeNull();
    expect(upd.error).not.toBeNull();
  });
});

describe('job_outbox', () => {
  it('membro enfileira job permitido no próprio tenant', async () => {
    const user = seedUser('corretor.demo');
    const { error } = await (
      await asUser('corretor.demo')
    )
      .from('job_outbox')
      .insert({ tenant_id: A, name: 'system.ping', payload: { origem: 'rls-test' } });
    expect(error).toBeNull();

    const { data } = await adminClient
      .from('job_outbox')
      .select('id, status, created_by')
      .eq('tenant_id', A)
      .eq('created_by', user.id)
      .contains('payload', { origem: 'rls-test' });
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) trackOutbox(row.id);
    expect(data!.every((r) => r.status === 'pending')).toBe(true);
  });

  it('job fora da lista permitida é recusado', async () => {
    const { error } = await (
      await asUser('admin.demo')
    )
      .from('job_outbox')
      .insert({ tenant_id: A, name: 'system.drop_everything' });
    expect(error).not.toBeNull();
  });

  it('usuário não define status, tentativas nem autor', async () => {
    const client = await asUser('admin.demo');
    for (const extra of [
      { status: 'enqueued' },
      { attempts: 3 },
      { created_by: seedUser('corretor.demo').id },
    ]) {
      const { error } = await client
        .from('job_outbox')
        .insert({ tenant_id: A, name: 'system.ping', ...extra });
      expect(error, JSON.stringify(extra)).not.toBeNull();
    }
  });
});
