-- Advisor 0028/0029: public.rls_auto_enable() é SECURITY DEFINER e estava executável por
-- anon/authenticated via /rest/v1/rpc. A função é criada pelo próprio Supabase em projetos de
-- nuvem (event trigger `ensure_rls`, liga RLS em tabela nova do public) e pode não existir no
-- Supabase local, por isso o bloco condicional. O event trigger continua funcionando: ele roda
-- como dono da função, sem depender de EXECUTE dos papéis da API.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
