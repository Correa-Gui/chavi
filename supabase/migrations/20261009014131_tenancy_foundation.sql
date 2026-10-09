-- Fase 0 · T3 + T4: base multi-tenant (tenants, memberships, profiles, audit_log, job_outbox),
-- funções de acesso e RLS. Ver docs/ARCHITECTURE.md §4 e ADRs 006, 007, 010.
--
-- Princípios:
--   * Toda tabela nasce com RLS habilitado e sem acesso para `anon`.
--   * `authenticated` recebe só os privilégios (e colunas) que cada política precisa.
--   * Funções security definer ficam no schema `private` (não exposto pela Data API),
--     com `search_path = ''` e nomes qualificados.

-- ---------------------------------------------------------------------------
-- Schema privado para funções auxiliares
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.membership_role as enum ('admin', 'gerente', 'corretor', 'financeiro');
create type public.job_outbox_status as enum ('pending', 'enqueued', 'failed');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 63),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
create index memberships_tenant_id_idx on public.memberships (tenant_id);
create index memberships_active_admins_idx on public.memberships (tenant_id)
  where role = 'admin' and active;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or length(full_name) <= 200),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid,  -- null quando a ação vem do service role / worker
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_tenant_at_idx on public.audit_log (tenant_id, at desc);

create table public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Lista fechada de jobs que a web pode pedir. Job novo = migration nova alterando esta lista.
  name text not null constraint job_outbox_name_allowed check (name in ('system.ping')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  run_after timestamptz not null default now(),
  status public.job_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  enqueued_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index job_outbox_tenant_id_idx on public.job_outbox (tenant_id);
create index job_outbox_pending_idx on public.job_outbox (run_after) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Funções de acesso (usadas pelas políticas)
-- ---------------------------------------------------------------------------

-- Tenants em que o usuário logado tem membership ATIVA. Security definer para não cair na
-- própria RLS de memberships (recursão). Sem usuário logado, retorna vazio.
create function private.auth_tenant_ids()
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
$$;

-- Tenants em que o usuário logado é admin ativo.
create function private.auth_admin_tenant_ids()
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
    and m.role = 'admin'
$$;

revoke all on function private.auth_tenant_ids() from public;
revoke all on function private.auth_admin_tenant_ids() from public;
grant execute on function private.auth_tenant_ids() to authenticated, service_role;
grant execute on function private.auth_admin_tenant_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Impede deixar um tenant sem admin ativo (rebaixar, desativar ou remover o último admin).
-- Vale para qualquer papel do banco, inclusive service role. Trava a linha do tenant para
-- serializar alterações concorrentes (dois admins rebaixando um ao outro ao mesmo tempo).
-- Exceção: exclusão do tenant inteiro. O `delete from tenants` remove a linha do tenant antes
-- de o cascade apagar as memberships; quando este trigger roda, o tenant já não é visível e a
-- remoção é liberada. Coberto por teste em tests/rls.
create function private.prevent_orphan_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  losing_admin boolean;
begin
  if not (old.role = 'admin' and old.active) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    losing_admin := true;
  else
    losing_admin := not (new.role = 'admin' and new.active and new.tenant_id = old.tenant_id);
  end if;

  if not losing_admin then
    return new;
  end if;

  -- Tenant sendo apagado (cascade a partir de tenants): libera.
  -- Se o tenant existe, trava a linha para serializar a checagem abaixo.
  perform 1 from public.tenants t where t.id = old.tenant_id for update;
  if not found then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.tenant_id = old.tenant_id
      and m.role = 'admin'
      and m.active
      and m.user_id <> old.user_id
  ) then
    raise exception 'O tenant precisa de pelo menos um admin ativo'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger memberships_prevent_orphan_tenant
  before update or delete on public.memberships
  for each row execute function private.prevent_orphan_tenant();

-- Toda mudança em memberships (convite, troca de papel, desativação, remoção) vai para audit_log.
create function private.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  -- Tenant sendo apagado em cascade: não há onde registrar (audit_log também cai em cascade).
  if not exists (select 1 from public.tenants t where t.id = row_tenant) then
    return null;
  end if;

  insert into public.audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
  values (
    row_tenant,
    (select auth.uid()),
    'memberships',
    coalesce(new.user_id, old.user_id)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_memberships();

-- Funções de trigger não recebem EXECUTE de ninguém: o Postgres só checa EXECUTE ao criar o
-- trigger (feito pelo dono, nesta migration), não quando ele dispara. Sem grant, nenhum cliente
-- consegue chamá-las diretamente.
revoke all on function private.set_updated_at() from public;
revoke all on function private.prevent_orphan_tenant() from public;
revoke all on function private.audit_memberships() from public;

-- ---------------------------------------------------------------------------
-- Privilégios: começa do zero e libera só o necessário
-- ---------------------------------------------------------------------------
revoke all on public.tenants, public.memberships, public.profiles, public.audit_log,
  public.job_outbox from anon, authenticated;

grant select on public.tenants to authenticated;
grant update (name, settings) on public.tenants to authenticated;

grant select on public.memberships to authenticated;
grant update (role, active) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

grant select on public.profiles to authenticated;
grant insert (user_id, full_name, phone_e164, avatar_url) on public.profiles to authenticated;
grant update (full_name, phone_e164, avatar_url) on public.profiles to authenticated;

grant select on public.audit_log to authenticated;

grant insert (tenant_id, name, payload, run_after) on public.job_outbox to authenticated;

-- audit_log é só de inserção, para todos (inclusive service role).
revoke update, delete, truncate on public.audit_log from service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.job_outbox enable row level security;

-- tenants: membro ativo lê; admin altera nome/configurações. Criar/apagar tenant: só service role.
create policy tenants_select on public.tenants
  for select to authenticated
  using (id in (select private.auth_tenant_ids()));

create policy tenants_update on public.tenants
  for update to authenticated
  using (id in (select private.auth_admin_tenant_ids()))
  with check (id in (select private.auth_admin_tenant_ids()));

-- memberships: membro ativo vê a equipe do tenant; só admin altera papel/ativo ou remove.
-- Sem política de INSERT: ninguém se insere em tenant nenhum (convite usa service role, ADR-007).
create policy memberships_select on public.memberships
  for select to authenticated
  using (tenant_id in (select private.auth_tenant_ids()));

create policy memberships_update on public.memberships
  for update to authenticated
  using (tenant_id in (select private.auth_admin_tenant_ids()))
  with check (tenant_id in (select private.auth_admin_tenant_ids()));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (tenant_id in (select private.auth_admin_tenant_ids()));

-- profiles: cada um lê e edita o próprio; membros ativos leem os perfis da mesma equipe.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (
      select m.user_id from public.memberships m
      where m.tenant_id in (select private.auth_tenant_ids())
    )
  );

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_log: só admin do tenant lê. Escrita só por trigger (security definer) ou service role.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (tenant_id in (select private.auth_admin_tenant_ids()));

-- job_outbox: membro ativo enfileira no próprio tenant. Leitura e atualização: só o worker.
create policy job_outbox_insert on public.job_outbox
  for insert to authenticated
  with check (
    tenant_id in (select private.auth_tenant_ids())
    and status = 'pending'
    and enqueued_at is null
    and attempts = 0
    and created_by = (select auth.uid())
  );
