-- Marco Demo · D1: leads, origens, eventos, conversas, mensagens, triagem, decisões da IA,
-- eventos de webhook, instâncias de WhatsApp e log de acesso a dado pessoal.
-- Ver docs/ARCHITECTURE.md §4–§6, ADRs 003, 005, 006, 007, 015 e 019.
--
-- Visibilidade (ARCHITECTURE §4):
--   * admin e gerente veem todos os leads do tenant;
--   * corretor vê os leads atribuídos a ele e os sem atribuição;
--   * financeiro não vê leads (só a partir da fase de comissões).
-- Conversas, mensagens, eventos e sessões de triagem seguem a visibilidade do lead.
-- webhook_events, whatsapp_instances e ai_decisions: nenhum acesso para usuários (só o worker).
-- Usuário altera só: etapa/motivo de perda do lead, modo da conversa ("Assumir conversa") e
-- grava o próprio acesso à ficha. Todo o resto é escrito pelo worker (chave secret).

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.lead_source_kind as enum
  ('whatsapp', 'whatsapp_ad', 'simulator', 'form', 'csv', 'manual', 'referral', 'portal');
create type public.lead_temperature as enum ('pending', 'hot', 'warm', 'cold', 'out_of_profile');
create type public.lead_stage as enum
  ('new', 'triage', 'qualified', 'visit', 'credit_analysis', 'won', 'lost');
-- Lista provisória (Q10). Valores fechados também evitam texto livre (e dado pessoal) no audit_log.
create type public.lead_lost_reason as enum
  ('sem_renda', 'restricao_credito', 'desistiu', 'comprou_outro', 'sem_contato', 'fora_do_perfil', 'outro');
create type public.conversation_status as enum ('open', 'closed');
create type public.conversation_mode as enum ('ai', 'human');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('lead', 'ai', 'human', 'system');
create type public.message_status as enum
  ('received', 'queued', 'sent', 'delivered', 'read', 'failed', 'blocked');
create type public.triage_state as enum ('greeting', 'consent', 'questions', 'closing', 'done');
create type public.ai_decision_kind as enum ('extraction', 'classification', 'reply');
create type public.webhook_event_status as enum ('received', 'processing', 'processed', 'failed', 'ignored');
create type public.whatsapp_integration as enum ('baileys', 'business');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind public.lead_source_kind not null,
  name text not null check (length(name) between 1 and 120),
  campaign text check (campaign is null or length(campaign) <= 200),
  external_ref text check (external_ref is null or length(external_ref) <= 200),
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, name)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text check (full_name is null or length(full_name) <= 200),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  source_id uuid references public.lead_sources (id) on delete set null,
  campaign text check (campaign is null or length(campaign) <= 200),
  temperature public.lead_temperature not null default 'pending',
  -- Frases do LeadScorer para "Por que é quente?". Nunca a pontuação (ADR-005).
  temperature_reasons text[] not null default '{}',
  scorer_version text,
  stage public.lead_stage not null default 'new',
  lost_reason public.lead_lost_reason,
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_at timestamptz,
  first_contact_at timestamptz,
  consent_at timestamptz,
  consent_text_version text,
  legal_basis text check (legal_basis is null or legal_basis in ('consentimento', 'execucao_contrato', 'legitimo_interesse')),
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Critério 4.2: "Perdido" exige motivo, também no banco.
  constraint leads_lost_requires_reason check (stage <> 'lost' or lost_reason is not null),
  constraint leads_reason_only_when_lost check (stage = 'lost' or lost_reason is null)
);
-- Base da deduplicação (ARCHITECTURE §5).
create unique index leads_tenant_phone_uidx on public.leads (tenant_id, phone_e164)
  where deleted_at is null;
create index leads_tenant_stage_idx on public.leads (tenant_id, stage);
create index leads_tenant_temperature_idx on public.leads (tenant_id, temperature);
create index leads_tenant_created_idx on public.leads (tenant_id, created_at desc);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_source_id_idx on public.leads (source_id);

create table public.lead_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z_.]*$' and length(type) <= 60),
  actor_type text not null check (actor_type in ('system', 'ai', 'user')),
  actor_id uuid,
  -- Só metadados (ids, etapas, origem). Nunca conteúdo de mensagem, telefone ou renda.
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now()
);
create index lead_events_lead_created_idx on public.lead_events (lead_id, created_at);
create index lead_events_tenant_id_idx on public.lead_events (tenant_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  status public.conversation_status not null default 'open',
  mode public.conversation_mode not null default 'ai',
  wa_instance text not null,
  -- JID exato do WhatsApp para responder (pode diferir do E.164 no 9º dígito).
  wa_jid text not null check (wa_jid ~ '^[0-9]+@s\.whatsapp\.net$'),
  window_expires_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel, wa_instance, wa_jid)
);
create index conversations_lead_id_idx on public.conversations (lead_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction public.message_direction not null,
  sender public.message_sender not null,
  body text check (body is null or length(body) <= 4096),
  media_type text check (media_type is null or length(media_type) <= 60),
  provider_message_id text check (provider_message_id is null or length(provider_message_id) <= 128),
  status public.message_status not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_message_id)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_tenant_id_idx on public.messages (tenant_id);

create table public.triage_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  state public.triage_state not null default 'greeting',
  -- Respostas extraídas (renda, vínculo, FGTS, entrada, prazo, região). Dinheiro em centavos.
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  questions_asked integer not null default 0 check (questions_asked >= 0),
  messages_count integer not null default 0 check (messages_count >= 0),
  prompt_version text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index triage_sessions_lead_id_idx on public.triage_sessions (lead_id);
create index triage_sessions_tenant_id_idx on public.triage_sessions (tenant_id);

create table public.ai_decisions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind public.ai_decision_kind not null,
  model text not null check (length(model) <= 100),
  prompt_version text not null check (length(prompt_version) <= 60),
  -- Entrada resumida, com dados pessoais mascarados (CLAUDE.md regra 4).
  input_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(input_summary) = 'object'),
  output jsonb not null default '{}'::jsonb check (jsonb_typeof(output) = 'object'),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index ai_decisions_lead_id_idx on public.ai_decisions (lead_id, created_at);
create index ai_decisions_tenant_id_idx on public.ai_decisions (tenant_id);

create table public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  instance_name text not null unique check (instance_name ~ '^[A-Za-z0-9_-]{1,64}$'),
  integration public.whatsapp_integration not null,
  -- SHA-256 (hex) do segredo enviado pela Evolution no header. O segredo em si não fica no banco.
  webhook_secret_hash text not null check (webhook_secret_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_instances_tenant_id_idx on public.whatsapp_instances (tenant_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  provider text not null check (provider in ('evolution')),
  external_id text not null check (length(external_id) between 1 and 128),
  instance_name text,
  -- Payload sem a apikey da Evolution (removida antes de gravar).
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status public.webhook_event_status not null default 'received',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or length(last_error) <= 300),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_id)
);
create index webhook_events_tenant_id_idx on public.webhook_events (tenant_id);
create index webhook_events_status_idx on public.webhook_events (status, received_at);

create table public.personal_data_access_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid not null default auth.uid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  purpose text not null check (purpose in ('ficha_lead', 'exportacao_titular')),
  at timestamptz not null default now()
);
create index personal_data_access_log_tenant_at_idx on public.personal_data_access_log (tenant_id, at desc);
create index personal_data_access_log_lead_id_idx on public.personal_data_access_log (lead_id);

-- ---------------------------------------------------------------------------
-- Funções de acesso
-- ---------------------------------------------------------------------------

-- Tenants em que o usuário logado tem membership ativa com um dos papéis informados.
create function private.auth_role_tenant_ids(roles public.membership_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.active
    and m.role = any (roles)
$$;

revoke all on function private.auth_role_tenant_ids(public.membership_role[]) from public;
grant execute on function private.auth_role_tenant_ids(public.membership_role[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger leads_set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();
create trigger triage_sessions_set_updated_at before update on public.triage_sessions
  for each row execute function private.set_updated_at();
create trigger whatsapp_instances_set_updated_at before update on public.whatsapp_instances
  for each row execute function private.set_updated_at();

-- Webhook gravado → job na outbox, na mesma transação (ADR-006). Só eventos novos (o
-- `on conflict do nothing` da ingestão não dispara insert, então duplicado não gera job).
create function private.enqueue_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id is null or new.status <> 'received' then
    return null;
  end if;
  insert into public.job_outbox (tenant_id, name, payload, created_by)
  values (new.tenant_id, 'whatsapp.ingest', jsonb_build_object('webhookEventId', new.id), null);
  return null;
end;
$$;

create trigger webhook_events_enqueue
  after insert on public.webhook_events
  for each row execute function private.enqueue_webhook_event();

-- Auditoria com lista fixa de campos (ADR-015). Nada de nome, telefone, e-mail, conteúdo ou renda.
create function private.audit_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.stage is not distinct from old.stage
     and new.lost_reason is not distinct from old.lost_reason
     and new.temperature is not distinct from old.temperature
     and new.assigned_to is not distinct from old.assigned_to
     and new.opted_out_at is not distinct from old.opted_out_at
     and new.deleted_at is not distinct from old.deleted_at then
    return null;  -- só mudanças relevantes para o histórico
  end if;

  insert into public.audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    (select auth.uid()),
    'leads',
    coalesce(new.id, old.id)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then jsonb_build_object(
      'stage', old.stage, 'lost_reason', old.lost_reason, 'temperature', old.temperature,
      'assigned_to', old.assigned_to, 'opted_out', old.opted_out_at is not null,
      'deleted', old.deleted_at is not null) end,
    case when tg_op in ('INSERT', 'UPDATE') then jsonb_build_object(
      'stage', new.stage, 'lost_reason', new.lost_reason, 'temperature', new.temperature,
      'assigned_to', new.assigned_to, 'opted_out', new.opted_out_at is not null,
      'deleted', new.deleted_at is not null) end
  );
  return null;
end;
$$;

create trigger leads_audit
  after insert or update or delete on public.leads
  for each row execute function private.audit_leads();

create function private.audit_conversations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mode is not distinct from old.mode and new.status is not distinct from old.status then
    return null;
  end if;
  insert into public.audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
  values (
    new.tenant_id,
    (select auth.uid()),
    'conversations',
    new.id::text,
    'update',
    jsonb_build_object('mode', old.mode, 'status', old.status),
    jsonb_build_object('mode', new.mode, 'status', new.status)
  );
  return null;
end;
$$;

create trigger conversations_audit
  after update on public.conversations
  for each row execute function private.audit_conversations();

revoke all on function private.enqueue_webhook_event() from public;
revoke all on function private.audit_leads() from public;
revoke all on function private.audit_conversations() from public;

-- Rede de proteção do audit_log ampliada com as chaves de dado pessoal das tabelas novas.
alter table public.audit_log drop constraint audit_log_no_personal_data;
alter table public.audit_log
  add constraint audit_log_no_personal_data check (
    not coalesce(before ?| array[
      'email', 'phone', 'phone_e164', 'telefone', 'full_name', 'push_name', 'pushName', 'wa_jid',
      'income', 'income_cents', 'renda', 'renda_cents', 'renda_bruta_cents', 'entrada_cents',
      'cpf', 'document', 'body', 'text', 'conversation', 'message', 'answers'
    ], false)
    and not coalesce(after ?| array[
      'email', 'phone', 'phone_e164', 'telefone', 'full_name', 'push_name', 'pushName', 'wa_jid',
      'income', 'income_cents', 'renda', 'renda_cents', 'renda_bruta_cents', 'entrada_cents',
      'cpf', 'document', 'body', 'text', 'conversation', 'message', 'answers'
    ], false)
  );

-- ---------------------------------------------------------------------------
-- job_outbox: novo job interno e usuários restritos aos jobs que a web pode pedir
-- ---------------------------------------------------------------------------
alter table public.job_outbox drop constraint job_outbox_name_allowed;
alter table public.job_outbox
  add constraint job_outbox_name_allowed check (name in ('system.ping', 'whatsapp.ingest'));

-- `whatsapp.ingest` só nasce pelo trigger de webhook_events; usuário nenhum pode pedi-lo.
drop policy job_outbox_insert on public.job_outbox;
create policy job_outbox_insert on public.job_outbox
  for insert to authenticated
  with check (
    tenant_id in (select private.auth_tenant_ids())
    and name in ('system.ping')
    and status = 'pending'
    and enqueued_at is null
    and attempts = 0
    and created_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
revoke all on public.lead_sources, public.leads, public.lead_events, public.conversations,
  public.messages, public.triage_sessions, public.ai_decisions, public.whatsapp_instances,
  public.webhook_events, public.personal_data_access_log
  from anon, authenticated;

grant select on public.lead_sources, public.leads, public.lead_events, public.conversations,
  public.messages, public.triage_sessions
  to authenticated;
grant update (stage, lost_reason) on public.leads to authenticated;
grant update (mode) on public.conversations to authenticated;
grant insert (tenant_id, lead_id, purpose) on public.personal_data_access_log to authenticated;
grant select on public.personal_data_access_log to authenticated;

-- Histórico só de inserção também para a chave secret.
revoke update, delete, truncate on public.ai_decisions, public.personal_data_access_log
  from service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.triage_sessions enable row level security;
alter table public.ai_decisions enable row level security;
alter table public.whatsapp_instances enable row level security;
alter table public.webhook_events enable row level security;
alter table public.personal_data_access_log enable row level security;

-- lead_sources: qualquer membro que vê leads (admin, gerente, corretor).
create policy lead_sources_select on public.lead_sources
  for select to authenticated
  using (tenant_id in (select private.auth_role_tenant_ids('{admin,gerente,corretor}')));

-- leads: admin/gerente veem todos; corretor vê os próprios e os sem atribuição.
create policy leads_select on public.leads
  for select to authenticated
  using (
    deleted_at is null
    and (
      tenant_id in (select private.auth_role_tenant_ids('{admin,gerente}'))
      or (
        tenant_id in (select private.auth_role_tenant_ids('{corretor}'))
        and (assigned_to is null or assigned_to = (select auth.uid()))
      )
    )
  );

create policy leads_update on public.leads
  for update to authenticated
  using (
    deleted_at is null
    and (
      tenant_id in (select private.auth_role_tenant_ids('{admin,gerente}'))
      or (
        tenant_id in (select private.auth_role_tenant_ids('{corretor}'))
        and (assigned_to is null or assigned_to = (select auth.uid()))
      )
    )
  )
  with check (
    tenant_id in (select private.auth_role_tenant_ids('{admin,gerente}'))
    or (
      tenant_id in (select private.auth_role_tenant_ids('{corretor}'))
      and (assigned_to is null or assigned_to = (select auth.uid()))
    )
  );

-- Filhos do lead: visíveis se o lead é visível (a subconsulta passa pela RLS de leads).
create policy lead_events_select on public.lead_events
  for select to authenticated
  using (lead_id in (select l.id from public.leads l));

create policy conversations_select on public.conversations
  for select to authenticated
  using (lead_id in (select l.id from public.leads l));

create policy conversations_update on public.conversations
  for update to authenticated
  using (lead_id in (select l.id from public.leads l))
  with check (lead_id in (select l.id from public.leads l));

create policy messages_select on public.messages
  for select to authenticated
  using (conversation_id in (select c.id from public.conversations c));

create policy triage_sessions_select on public.triage_sessions
  for select to authenticated
  using (lead_id in (select l.id from public.leads l));

-- ai_decisions, whatsapp_instances, webhook_events: RLS ligada e nenhuma política para usuários.

-- personal_data_access_log: cada um registra o próprio acesso a um lead que consegue ver;
-- só admin lê o log do tenant.
create policy personal_data_access_log_insert on public.personal_data_access_log
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and lead_id in (select l.id from public.leads l where l.tenant_id = personal_data_access_log.tenant_id)
  );

create policy personal_data_access_log_select on public.personal_data_access_log
  for select to authenticated
  using (tenant_id in (select private.auth_admin_tenant_ids()));
