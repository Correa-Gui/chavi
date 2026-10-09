---
paths:
  - "supabase/**"
  - "packages/db/**"
---

# Regras de banco

- Toda tabela de negócio: `tenant_id uuid not null references tenants(id)`, RLS habilitado,
  políticas de select/insert/update/delete usando `(select private.auth_tenant_ids())`.
  Exceção: `audit_log` não tem FK para `tenants`, para o histórico sobreviver à exclusão (ADR-015).
- Todo trigger de auditoria monta before/after a partir de uma lista fixa de campos permitidos
  por tabela, nunca da linha inteira. A constraint `audit_log_no_personal_data` é só uma rede de
  segurança.
- Toda migration nova com tabela de negócio vem com testes em `tests/rls/`.
- Funções `security definer` sempre com `set search_path = ''` e nomes qualificados.
- Dinheiro em `bigint` (centavos); percentuais em `integer` (basis points).
- Índices para toda coluna usada em filtro de tela (`tenant_id` + coluna).
- Nunca editar migration já aplicada; crie uma nova.
- Depois de mudar o schema, rode `pnpm db:types`.
