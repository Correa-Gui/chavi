-- Dados de negócio fictícios para desenvolvimento e CI. Idempotente.
-- Usuários, memberships e perfis NÃO ficam aqui: são criados por `pnpm db:seed` via API admin
-- (ver scripts/src/seed-data.ts e ADR-008). Os UUIDs abaixo precisam bater com seed-data.ts.

insert into public.tenants (id, name, slug)
values
  ('00000000-0000-4000-a000-00000000000a', 'Imobiliária Demo', 'imobiliaria-demo'),
  ('00000000-0000-4000-a000-00000000000b', 'Imobiliária Teste', 'imobiliaria-teste')
on conflict (id) do nothing;
