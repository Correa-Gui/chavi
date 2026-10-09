-- ADR-015: o histórico de auditoria sobrevive à exclusão do tenant e não guarda dado pessoal.
--
-- 1. audit_log deixa de ter FK para tenants (antes: on delete cascade, que apagava o histórico).
--    tenant_id continua obrigatório e indexado; depois da exclusão ele aponta para um tenant que
--    não existe mais, e só a chave secret (worker/suporte) lê essas linhas.
-- 2. before/after passam a ser montados com allowlist de campos por entidade (nada de
--    to_jsonb(linha inteira)), e uma constraint barra chaves de dado pessoal como rede de proteção.
-- 3. A exclusão de um tenant e a remoção em cascade das memberships passam a ser registradas.

alter table public.audit_log drop constraint audit_log_tenant_id_fkey;

-- Rede de proteção: nenhuma chave de dado pessoal no primeiro nível de before/after.
-- A defesa principal é a allowlist nas funções de auditoria.
alter table public.audit_log
  add constraint audit_log_no_personal_data check (
    not coalesce(before ?| array[
      'email', 'phone', 'phone_e164', 'telefone', 'full_name',
      'income', 'income_cents', 'renda', 'renda_cents', 'cpf', 'document'
    ], false)
    and not coalesce(after ?| array[
      'email', 'phone', 'phone_e164', 'telefone', 'full_name',
      'income', 'income_cents', 'renda', 'renda_cents', 'cpf', 'document'
    ], false)
  );

-- memberships: registra só papel e status. user_id vai em entity_id (identificador, não contato).
-- Agora também registra a remoção em cascade quando o tenant é apagado.
create or replace function private.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    (select auth.uid()),
    'memberships',
    coalesce(new.user_id, old.user_id)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE')
      then jsonb_build_object('role', old.role, 'active', old.active) end,
    case when tg_op in ('INSERT', 'UPDATE')
      then jsonb_build_object('role', new.role, 'active', new.active) end
  );
  return null;
end;
$$;

-- tenants: registra a exclusão (nome e slug são da empresa, não de pessoa).
create function private.audit_tenant_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
  values (
    old.id,
    (select auth.uid()),
    'tenants',
    old.id::text,
    'delete',
    jsonb_build_object('name', old.name, 'slug', old.slug),
    null
  );
  return old;
end;
$$;

-- BEFORE DELETE: grava antes do cascade remover as memberships, deixando a ordem do histórico
-- legível (tenant apagado, depois memberships removidas).
create trigger tenants_audit_delete
  before delete on public.tenants
  for each row execute function private.audit_tenant_delete();

revoke all on function private.audit_tenant_delete() from public;
