---
paths:
  - "supabase/**"
  - "packages/db/**"
---

# Regras de banco

- Toda tabela de negócio: `tenant_id uuid not null references tenants(id)`, RLS habilitado,
  políticas de select/insert/update/delete usando `auth_tenant_ids()`.
- Toda migration nova com tabela de negócio vem com testes em `tests/rls/`.
- Funções `security definer` sempre com `set search_path = ''` e nomes qualificados.
- Dinheiro em `bigint` (centavos); percentuais em `integer` (basis points).
- Índices para toda coluna usada em filtro de tela (`tenant_id` + coluna).
- Nunca editar migration já aplicada; crie uma nova.
- Depois de mudar o schema, rode `pnpm db:types`.
