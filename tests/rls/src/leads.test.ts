import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_TENANTS, seedUser } from '@chavi/scripts/seed-data';
import { adminClient, anonClient, asUser } from './clients';

/**
 * Marco Demo · D1: isolamento das tabelas de leads, conversas e triagem (critério 1.9 e
 * ARCHITECTURE §4). Dados temporários criados com a chave secret e apagados no fim.
 *
 * Cenário (tenant A = Demo, B = Teste):
 *   leadA_free     sem atribuição           → admin, gerente e corretor de A veem
 *   leadA_corretor atribuído ao corretor A  → admin, gerente e corretor de A veem
 *   leadA_admin    atribuído ao admin A     → admin e gerente de A veem; corretor NÃO
 *   leadB          tenant B                 → ninguém de A vê
 * Financeiro não vê leads. Ninguém vê ai_decisions, webhook_events e whatsapp_instances.
 */

const A = SEED_TENANTS.demo.id;
const B = SEED_TENANTS.teste.id;
const RUN = randomUUID().slice(0, 8);

const fakePhone = () => `+55169${String(randomInt(10_000_000, 99_999_999))}`;

type Ids = { lead: string; conversation: string; message: string };
const ids: Record<'freeA' | 'corretorA' | 'adminA' | 'B', Ids> = {} as never;
let sourceA = '';
const createdWebhookEvents: string[] = [];
const createdInstances: string[] = [];

async function insertOrThrow<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await adminClient.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as T;
}

async function createLeadWithConversation(
  tenantId: string,
  assignedTo: string | null,
  sourceId: string | null,
): Promise<Ids> {
  const phone = fakePhone();
  const lead = await insertOrThrow<{ id: string }>('leads', {
    tenant_id: tenantId,
    full_name: `rls-test ${RUN}`,
    phone_e164: phone,
    source_id: sourceId,
    stage: 'triage',
    assigned_to: assignedTo,
  });
  const conversation = await insertOrThrow<{ id: string }>('conversations', {
    tenant_id: tenantId,
    lead_id: lead.id,
    wa_instance: `rls-test-${RUN}`,
    wa_jid: `${phone.slice(1)}@s.whatsapp.net`,
  });
  const message = await insertOrThrow<{ id: string }>('messages', {
    tenant_id: tenantId,
    conversation_id: conversation.id,
    direction: 'inbound',
    sender: 'lead',
    body: 'mensagem de teste',
    provider_message_id: `rls-test-${randomUUID()}`,
    status: 'received',
  });
  await insertOrThrow('lead_events', {
    tenant_id: tenantId,
    lead_id: lead.id,
    type: 'lead.created',
    actor_type: 'system',
  });
  await insertOrThrow('triage_sessions', {
    tenant_id: tenantId,
    lead_id: lead.id,
    conversation_id: conversation.id,
  });
  await insertOrThrow('ai_decisions', {
    tenant_id: tenantId,
    lead_id: lead.id,
    kind: 'reply',
    model: 'teste',
    prompt_version: 'triage.v0-teste',
  });
  return { lead: lead.id, conversation: conversation.id, message: message.id };
}

async function leadState(id: string) {
  const { data, error } = await adminClient
    .from('leads')
    .select('stage, lost_reason, temperature, phone_e164')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  const source = await insertOrThrow<{ id: string }>('lead_sources', {
    tenant_id: A,
    kind: 'whatsapp',
    name: `rls-test ${RUN}`,
  });
  sourceA = source.id;
  ids.freeA = await createLeadWithConversation(A, null, sourceA);
  ids.corretorA = await createLeadWithConversation(A, seedUser('corretor.demo').id, sourceA);
  ids.adminA = await createLeadWithConversation(A, seedUser('admin.demo').id, sourceA);
  ids.B = await createLeadWithConversation(B, null, null);
});

afterAll(async () => {
  // Apagar o lead leva conversas, mensagens, eventos, triagem, decisões e logs de acesso.
  const leadIds = Object.values(ids).map((i) => i.lead);
  if (leadIds.length) await adminClient.from('leads').delete().in('id', leadIds);
  if (sourceA) await adminClient.from('lead_sources').delete().eq('id', sourceA);
  if (createdWebhookEvents.length) {
    await adminClient
      .from('job_outbox')
      .delete()
      .eq('name', 'whatsapp.ingest')
      .in('payload->>webhookEventId', createdWebhookEvents);
    await adminClient.from('webhook_events').delete().in('id', createdWebhookEvents);
  }
  if (createdInstances.length) {
    await adminClient.from('whatsapp_instances').delete().in('id', createdInstances);
  }
});

const visible = async (key: string, table: string, column: string, values: string[]) => {
  const { data, error } = await (await asUser(key)).from(table).select(column).in(column, values);
  expect(error, `${key} ${table}`).toBeNull();
  return new Set((data as unknown as Record<string, string>[]).map((r) => r[column]));
};

describe('leads · visibilidade por papel (ARCHITECTURE §4)', () => {
  const all = () => [ids.freeA.lead, ids.corretorA.lead, ids.adminA.lead, ids.B.lead];

  it.each(['admin.demo', 'gerente.demo'])(
    '%s vê todos os leads de A e nenhum de B',
    async (key) => {
      const seen = await visible(key, 'leads', 'id', all());
      expect(seen).toEqual(new Set([ids.freeA.lead, ids.corretorA.lead, ids.adminA.lead]));
    },
  );

  it('corretor vê os próprios e os sem atribuição, e não os de outra pessoa', async () => {
    const seen = await visible('corretor.demo', 'leads', 'id', all());
    expect(seen).toEqual(new Set([ids.freeA.lead, ids.corretorA.lead]));
  });

  it('financeiro não vê leads nem origens', async () => {
    expect((await visible('financeiro.demo', 'leads', 'id', all())).size).toBe(0);
    expect((await visible('financeiro.demo', 'lead_sources', 'id', [sourceA])).size).toBe(0);
  });

  it('usuário de B não vê lead de A, nem com o mesmo telefone (1.9)', async () => {
    const seen = await visible('admin.teste', 'leads', 'id', all());
    expect(seen).toEqual(new Set([ids.B.lead]));
  });

  it('mesmo telefone pode existir em tenants diferentes, mas não duas vezes no mesmo', async () => {
    const { data: a } = await adminClient
      .from('leads')
      .select('phone_e164')
      .eq('id', ids.freeA.lead)
      .single();
    const inB = await adminClient
      .from('leads')
      .insert({ tenant_id: B, phone_e164: a!.phone_e164 })
      .select('id')
      .single();
    expect(inB.error).toBeNull();
    await adminClient.from('leads').delete().eq('id', inB.data!.id);

    const dupInA = await adminClient
      .from('leads')
      .insert({ tenant_id: A, phone_e164: a!.phone_e164 });
    expect(dupInA.error).not.toBeNull();
  });
});

describe('filhos do lead seguem a visibilidade do lead', () => {
  const cases = [
    ['conversations', 'id', (i: Ids) => i.conversation],
    ['messages', 'id', (i: Ids) => i.message],
    ['lead_events', 'lead_id', (i: Ids) => i.lead],
    ['triage_sessions', 'lead_id', (i: Ids) => i.lead],
  ] as const;

  it.each(cases)('%s: corretor de A só vê os dos leads que vê', async (table, column, pick) => {
    const values = [pick(ids.freeA), pick(ids.corretorA), pick(ids.adminA), pick(ids.B)];
    const seen = await visible('corretor.demo', table, column, values);
    expect(seen).toEqual(new Set([pick(ids.freeA), pick(ids.corretorA)]));
  });

  it.each(cases)('%s: admin de A não vê os de B', async (table, column, pick) => {
    const values = [pick(ids.freeA), pick(ids.B)];
    const seen = await visible('admin.demo', table, column, values);
    expect(seen).toEqual(new Set([pick(ids.freeA)]));
  });
});

describe('filho e lead sempre no mesmo tenant (FK composta)', () => {
  it('nem a chave secret grava conversa, mensagem, evento ou decisão com tenant trocado', async () => {
    const attempts: [string, Record<string, unknown>][] = [
      [
        'conversations',
        {
          tenant_id: B,
          lead_id: ids.freeA.lead,
          wa_instance: `rls-test-${RUN}`,
          wa_jid: '5516900000000@s.whatsapp.net',
        },
      ],
      [
        'messages',
        {
          tenant_id: B,
          conversation_id: ids.freeA.conversation,
          direction: 'inbound',
          sender: 'lead',
          status: 'received',
        },
      ],
      ['lead_events', { tenant_id: B, lead_id: ids.freeA.lead, type: 'x', actor_type: 'system' }],
      [
        'ai_decisions',
        { tenant_id: B, lead_id: ids.freeA.lead, kind: 'reply', model: 'x', prompt_version: 'x' },
      ],
    ];
    for (const [table, row] of attempts) {
      const { error } = await adminClient.from(table).insert(row);
      expect(error, table).not.toBeNull();
    }
  });
});

describe('tabelas internas não têm leitura para nenhum usuário', () => {
  it.each(['ai_decisions', 'webhook_events', 'whatsapp_instances'])(
    '%s: nem o admin lê',
    async (table) => {
      for (const key of ['admin.demo', 'gerente.demo', 'corretor.demo']) {
        const { data } = await (await asUser(key)).from(table).select('*').limit(5);
        expect(data ?? [], `${key} ${table}`).toEqual([]);
      }
    },
  );

  it('visitante sem login não lê nenhuma tabela nova', async () => {
    const client = anonClient();
    for (const table of [
      'leads',
      'lead_sources',
      'lead_events',
      'conversations',
      'messages',
      'triage_sessions',
      'ai_decisions',
      'webhook_events',
      'whatsapp_instances',
      'personal_data_access_log',
    ]) {
      const { data } = await client.from(table).select('*').limit(5);
      expect(data ?? [], table).toEqual([]);
    }
  });
});

describe('leads · escrita', () => {
  it('corretor move a etapa de lead visível', async () => {
    const client = await asUser('corretor.demo');
    const { error } = await client
      .from('leads')
      .update({ stage: 'qualified' })
      .eq('id', ids.freeA.lead);
    expect(error).toBeNull();
    expect((await leadState(ids.freeA.lead)).stage).toBe('qualified');
  });

  it('corretor não altera lead atribuído a outra pessoa nem lead de B', async () => {
    const client = await asUser('corretor.demo');
    await client.from('leads').update({ stage: 'visit' }).eq('id', ids.adminA.lead);
    await client.from('leads').update({ stage: 'visit' }).eq('id', ids.B.lead);
    expect((await leadState(ids.adminA.lead)).stage).toBe('triage');
    expect((await leadState(ids.B.lead)).stage).toBe('triage');
  });

  it('admin de A não altera lead de B', async () => {
    await (await asUser('admin.demo')).from('leads').update({ stage: 'won' }).eq('id', ids.B.lead);
    expect((await leadState(ids.B.lead)).stage).toBe('triage');
  });

  it('usuário não altera temperatura, telefone nem atribuição (colunas fechadas)', async () => {
    const client = await asUser('admin.demo');
    for (const patch of [
      { temperature: 'hot' },
      { phone_e164: '+5516999999999' },
      { assigned_to: seedUser('admin.demo').id },
      { tenant_id: B },
    ]) {
      const { error } = await client.from('leads').update(patch).eq('id', ids.freeA.lead);
      expect(error, JSON.stringify(Object.keys(patch))).not.toBeNull();
    }
    expect((await leadState(ids.freeA.lead)).temperature).toBe('pending');
  });

  it('"Perdido" exige motivo (4.2) e o histórico não guarda dado pessoal', async () => {
    const client = await asUser('gerente.demo');
    const semMotivo = await client
      .from('leads')
      .update({ stage: 'lost' })
      .eq('id', ids.corretorA.lead);
    expect(semMotivo.error).not.toBeNull();

    const comMotivo = await client
      .from('leads')
      .update({ stage: 'lost', lost_reason: 'desistiu' })
      .eq('id', ids.corretorA.lead);
    expect(comMotivo.error).toBeNull();

    const { data: audit } = await adminClient
      .from('audit_log')
      .select('actor_id, before, after')
      .eq('entity', 'leads')
      .eq('entity_id', ids.corretorA.lead)
      .eq('action', 'update')
      .order('id', { ascending: false })
      .limit(1)
      .single();
    expect(audit!.actor_id).toBe(seedUser('gerente.demo').id);
    expect(audit!.after).toMatchObject({ stage: 'lost', lost_reason: 'desistiu' });
    const keys = [...Object.keys(audit!.before ?? {}), ...Object.keys(audit!.after ?? {})];
    for (const forbidden of ['full_name', 'phone_e164', 'email', 'body', 'answers']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('usuário não cria nem apaga lead', async () => {
    const client = await asUser('admin.demo');
    const created = await client.from('leads').insert({ tenant_id: A, phone_e164: fakePhone() });
    expect(created.error).not.toBeNull();
    await client.from('leads').delete().eq('id', ids.freeA.lead);
    expect(await leadState(ids.freeA.lead)).toBeTruthy();
  });
});

describe('conversas · "Assumir conversa"', () => {
  it('gerente de A muda o modo da conversa de lead visível', async () => {
    const client = await asUser('gerente.demo');
    const { error } = await client
      .from('conversations')
      .update({ mode: 'human' })
      .eq('id', ids.adminA.conversation);
    expect(error).toBeNull();
    const { data } = await adminClient
      .from('conversations')
      .select('mode')
      .eq('id', ids.adminA.conversation)
      .single();
    expect(data!.mode).toBe('human');
  });

  it('corretor não muda conversa de lead que não vê, nem de B', async () => {
    const client = await asUser('corretor.demo');
    await client.from('conversations').update({ mode: 'human' }).eq('id', ids.B.conversation);
    const { data } = await adminClient
      .from('conversations')
      .select('mode')
      .eq('id', ids.B.conversation)
      .single();
    expect(data!.mode).toBe('ai');
  });

  it('usuário não troca o JID nem a instância da conversa', async () => {
    const { error } = await (
      await asUser('admin.demo')
    )
      .from('conversations')
      .update({ wa_jid: '5516999999999@s.whatsapp.net' })
      .eq('id', ids.freeA.conversation);
    expect(error).not.toBeNull();
  });
});

describe('personal_data_access_log', () => {
  it('corretor registra acesso à ficha de lead visível', async () => {
    const { error } = await (
      await asUser('corretor.demo')
    )
      .from('personal_data_access_log')
      .insert({ tenant_id: A, lead_id: ids.freeA.lead, purpose: 'ficha_lead' });
    expect(error).toBeNull();
  });

  it('não registra acesso a lead invisível, de outro tenant ou em nome de outra pessoa', async () => {
    const client = await asUser('corretor.demo');
    const rows: Record<string, string>[] = [
      { tenant_id: A, lead_id: ids.adminA.lead, purpose: 'ficha_lead' },
      { tenant_id: B, lead_id: ids.B.lead, purpose: 'ficha_lead' },
      { tenant_id: A, lead_id: ids.B.lead, purpose: 'ficha_lead' },
      {
        tenant_id: A,
        lead_id: ids.freeA.lead,
        purpose: 'ficha_lead',
        actor_id: seedUser('admin.demo').id,
      },
    ];
    for (const row of rows) {
      const { error } = await client.from('personal_data_access_log').insert(row);
      expect(error, JSON.stringify(row)).not.toBeNull();
    }
  });

  it('só admin lê o log de acessos', async () => {
    const corretor = await (
      await asUser('corretor.demo')
    )
      .from('personal_data_access_log')
      .select('id')
      .eq('lead_id', ids.freeA.lead);
    expect(corretor.data ?? []).toEqual([]);
    const admin = await (
      await asUser('admin.demo')
    )
      .from('personal_data_access_log')
      .select('actor_id')
      .eq('lead_id', ids.freeA.lead);
    expect(admin.data).toContainEqual({ actor_id: seedUser('corretor.demo').id });
  });
});

describe('webhook_events → outbox (ADR-006)', () => {
  it('evento novo gera um job whatsapp.ingest; o mesmo evento de novo não gera outro', async () => {
    const externalId = `rls-test-${randomUUID()}`;
    const row = {
      tenant_id: A,
      provider: 'evolution',
      external_id: externalId,
      instance_name: `rls-test-${RUN}`,
      payload: { event: 'messages.upsert' },
    };
    const first = await adminClient.from('webhook_events').insert(row).select('id').single();
    expect(first.error).toBeNull();
    createdWebhookEvents.push(first.data!.id);

    const again = await adminClient
      .from('webhook_events')
      .upsert(row, { onConflict: 'provider,external_id', ignoreDuplicates: true });
    expect(again.error).toBeNull();

    const { data: jobs } = await adminClient
      .from('job_outbox')
      .select('tenant_id, name')
      .eq('payload->>webhookEventId', first.data!.id);
    expect(jobs).toEqual([{ tenant_id: A, name: 'whatsapp.ingest' }]);
  });

  it('usuário não pede whatsapp.ingest pela outbox', async () => {
    const { error } = await (
      await asUser('admin.demo')
    )
      .from('job_outbox')
      .insert({ tenant_id: A, name: 'whatsapp.ingest', payload: {} });
    expect(error).not.toBeNull();
  });

  it('whatsapp_instances guarda só o hash do segredo', async () => {
    const bad = await adminClient.from('whatsapp_instances').insert({
      tenant_id: A,
      instance_name: `rls-test-${RUN}`,
      integration: 'baileys',
      webhook_secret_hash: 'segredo-em-texto-puro',
    });
    expect(bad.error).not.toBeNull();

    const ok = await adminClient
      .from('whatsapp_instances')
      .insert({
        tenant_id: A,
        instance_name: `rls-test-${RUN}`,
        integration: 'baileys',
        webhook_secret_hash: 'a'.repeat(64),
      })
      .select('id')
      .single();
    expect(ok.error).toBeNull();
    createdInstances.push(ok.data!.id);
  });
});
