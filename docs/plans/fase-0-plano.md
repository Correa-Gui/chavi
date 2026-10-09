# Plano da Fase 0: Fundação (Chavi) — v2

Status: aprovado (v3, ambiente em nuvem). Começar pela T1.
ADRs relacionados: 006 a 010 em `docs/DECISIONS.md`.

## 0. Mudança de ambiente (v3)
Sem Docker e sem Supabase local na máquina do fundador. Dev usa o projeto Supabase de nuvem
**chavi-dev** (ref `vvdossmsqeiimhwousjf`, sa-east-1, Postgres 17), acessado via MCP. Produção será
outro projeto, depois. O CI (GitHub Actions, Linux) continua usando Supabase local (`supabase start`).
- Migrations: **arquivo primeiro** em `supabase/migrations/`, depois `apply_migration` pelo MCP. Nunca alterar schema sem o arquivo.
- Depois de cada migration: rodar `get_advisors` (security) pelo MCP e mostrar os alertas ao fundador antes de seguir.
- O MCP enxerga a organização inteira (há outros projetos). Toda chamada usa só o ref do chavi-dev.
- Removidos do plano: Docker local, Mailpit, `supabase start` na máquina do fundador.

## Contexto
Fase 0 entrega: monorepo rodando, login, RLS provada por teste, shell visual, worker pg-boss com job de exemplo (critérios 0.1 a 0.8 de `docs/VALIDATION.md`).

## 1. Decisões fechadas (respostas do fundador)
1. Fase 0 em projeto Supabase de nuvem só de desenvolvimento (chavi-dev). Sem Supabase local na máquina do fundador; CI usa local.
2. ~~Docker + WSL2~~ (removido na v3): sem Docker. Onde o projeto roda (Windows ou WSL) fica a critério do fundador; só Node 22.12+ e pnpm são exigidos.
3. Deploy do worker: Fase 1. `DATABASE_URL_DIRECT` aponta para o **session pooler (porta 5432) do chavi-dev**, **nunca 6543**. Env Zod do worker rejeita porta 6543.
4. Papéis: só admin altera papéis/convida; demais leem só o próprio tenant.
5. Login por **OTP de 6 dígitos por e-mail** (`signInWithOtp` + `verifyOtp`, sem magic link). Em dev, e-mail padrão do Supabase (sem Mailpit; limite baixo de envios). Antes do piloto é preciso SMTP próprio (ADR-010). Senha só para usuários de teste do chavi-dev.
6. Node 22.12+, pnpm via corepack (`packageManager` no package.json, `.nvmrc`). `chavi/` com **git próprio**, separado do repo pai (`git init` na T1).

## 2. Versões e fontes (registro npm, 2026-10-08)
| Item | Versão | Fonte |
|---|---|---|
| Next.js | 16.4.0 (Node >= 20.9) | https://registry.npmjs.org/next/latest |
| Supabase CLI | 2.120.0 | https://registry.npmjs.org/supabase/latest |
| pg-boss | 12.37.1 (Node >= 22.12, PG >= 13) | https://registry.npmjs.org/pg-boss/latest , https://github.com/timgit/pg-boss |
| Turborepo | 2.11.7 | https://registry.npmjs.org/turbo/latest |
| Tailwind CSS | 4.3.3 | https://registry.npmjs.org/tailwindcss/latest |
| shadcn CLI | 4.21.4 | https://registry.npmjs.org/shadcn/latest |
| Motion | 14.0.0 (`motion/react`) | https://registry.npmjs.org/motion/latest |

**Next 16: `middleware` virou `proxy`** (v16.0.0; roda em Node.js por padrão; `runtime` não é configurável). Arquivo `apps/web/proxy.ts`, export `proxy`. Fonte: https://nextjs.org/docs/app/api-reference/file-conventions/proxy . Proxy só renova sessão Supabase e redireciona; **autorização real em cada server action/route** (a doc avisa que o matcher não cobre Server Functions de forma confiável).

Antes do scaffold: ler changelog/breaking changes de Next 16, Tailwind 4, Motion 14, pg-boss 12; fixar versões exatas.

## 3. Árvore de pastas
```
chavi/  (git próprio)
  apps/
    web/            Next.js 16: app/, proxy.ts, /dev/ui só em dev, app/globals.css importa tokens
    worker/         Node + tsx: src/index.ts, outbox-relay.ts, jobs/system.ping.ts, env.ts, logger.ts
  packages/
    core/           domínio puro
    db/             clientes Supabase (browser/server), tipos gerados, enqueue (grava outbox), server-only/admin-invite
    integrations/   whatsapp/ llm/ (stubs)
    config/         tsconfig, eslint, prettier, tokens.css (@theme)
  supabase/         config.toml, migrations/, seed.sql
  scripts/          seed-users.ts (pnpm db:seed)
  tests/rls/  tests/e2e/
  docs/ prompts/ .claude/ .github/workflows/ci.yml
  turbo.json pnpm-workspace.yaml package.json .env.example .nvmrc .gitattributes
```
`.gitattributes`: `* text=auto eol=lf`.

## 4. Scripts raiz
`dev` · `build` · `lint` · `typecheck` · `test` · `test:rls` · `test:e2e` · `format` · `db:seed` (cria usuários de teste, ver A) · `db:types` (MCP `generate_typescript_types` ou `supabase gen types typescript --project-id $SUPABASE_DEV_PROJECT_REF`, sem Docker) · `jobs:replay` (stub). Removidos: `db:start`, `db:reset`. Só o CI usa `supabase start` e `supabase db reset`. Atualizar "Comandos" do CLAUDE.md ao final.

## 5. Ajustes A–F

**A. Seed de usuários por script.** `seed.sql`: só dados de negócio (2 tenants com UUIDs fixos: "Imobiliária Demo", "Imobiliária Teste"). `pnpm db:seed` (`scripts/seed-users.ts`) usa API admin (`auth.admin.createUser`, e-mail confirmado, senha local de teste) para criar 4 papéis × 2 tenants (+ 1 usuário multi-tenant para testar seleção de imobiliária), depois insere `memberships`/`profiles`. UUIDs e e-mails determinísticos, idempotente. **Recusa rodar se o project ref extraído de `SUPABASE_URL` for diferente de `SUPABASE_DEV_PROJECT_REF`** (chavi-dev). No CI (Supabase local, URL localhost) a checagem aceita localhost somente quando `CI=true`. Fluxo dev: `pnpm db:seed` após aplicar migrations. Como não há `db reset` em nuvem, o seed é idempotente (upsert).

**B. Autenticação nos testes RLS: senha** (ADR-008). Cada teste faz `signInWithPassword` com o usuário de teste e usa o JWT resultante num cliente com a anon key. Service role só no setup/teardown para contagens de controle. **Local: roda contra o chavi-dev**, com usuários criados pelo seed, e **limpa os dados criados no teste** (prefixo/marcador nos registros, `afterAll` remove). **CI: roda contra Supabase local** (`supabase start`). Os testes se recusam a rodar se o ref não for o chavi-dev (ou localhost no CI). Documentar em `tests/rls/README.md`.

**C. Convite = único uso de service role acionado por usuário** (ADR-007). Módulo `packages/db/src/server-only/admin-invite.ts` (`import 'server-only'`): (1) com cliente RLS confirma que o chamador é `admin` ativo do tenant alvo; (2) valida Zod (e-mail, papel, tenantId); (3) só então usa service role para `inviteUserByEmail` e insere `memberships`; (4) grava `audit_log` (ator, tenant, papel, e-mail mascarado). Regra `no-restricted-imports` impede importar o módulo/service role fora dele e do worker/scripts.

**D. Web não usa pg-boss** (ADR-006). Web grava jobs em `job_outbox(id, tenant_id, name, payload jsonb, run_after, status, enqueued_at, created_at)` com RLS (membro insere só no próprio tenant). Worker relê a outbox (poll curto + LISTEN/NOTIFY opcional, session pooler 5432 do chavi-dev) e faz `boss.send(name, data, { singletonKey: outbox.id })`, marcando `enqueued_at`. `enqueue()` em `packages/db` (tenantId obrigatório, Zod) insere na outbox. pg-boss usa `DATABASE_URL_DIRECT`; schema `pgboss` sem grants para `anon`/`authenticated`. README do pg-boss não documenta compatibilidade com poolers; decisão conservadora. Docs Supabase: https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI

**E. Testes extra de `memberships`.** Sem policy de INSERT para `authenticated` (inserção só pelo módulo de convite): teste prova que ninguém se insere em outro tenant nem no próprio. UPDATE/DELETE só admin do tenant, `with check` mantém `tenant_id`. Trigger `BEFORE UPDATE/DELETE` impede deixar tenant sem admin ativo (inclusive via service role). Políticas usam `(select auth.uid())` e `tenant_id in (select auth_tenant_ids())`. Testes cobrem também `job_outbox`.

**F. Tailwind 4: tokens via CSS `@theme`, sem preset** (ADR-009). `packages/config/tokens.css` com `@theme { --color-...; --font-...; --radius-... }`, importado em `apps/web/app/globals.css` (`@import "tailwindcss"; @import "@chavi/config/tokens.css";`). Sem `tailwind.config.js`. Docs a corrigir na T16:
- `docs/ARCHITECTURE.md` linha 55 ("tailwind preset" → "tokens.css com @theme"); adicionar nota do `proxy.ts` na seção 4
- `docs/DESIGN.md` linha 17 ("Tailwind preset" → "tokens CSS `@theme`")
- `.claude/rules/frontend.md` ("tokens do preset")
- `prompts/fase-0-fundacao.md` prompt 0.4 ("preset do Tailwind")

## 6. Tarefas (aceite)
| # | Tarefa | Aceite |
|---|---|---|
| T1 | `git init`, `.gitattributes`, `.nvmrc`, pnpm+Turborepo, TS strict, ESLint/Prettier/Vitest, Zod env por app, `.env.example` | 0.1 |
| T2 | CI (lint, typecheck, test, `supabase start` no runner Linux, test:rls local) | 0.6 |
| T3 | Migration 1 (arquivo em `supabase/migrations/` primeiro, depois `apply_migration` no chavi-dev, depois advisors de segurança mostrados ao fundador): `tenants`, `memberships`, `profiles`, `audit_log`, `job_outbox`, enums, `auth_tenant_ids()` (security definer, search_path fixo), trigger último-admin | base 0.3–0.5 |
| T4 | RLS em todas as tabelas (E); mesma rotina: arquivo → `apply_migration` → advisors | 0.3, 0.4, 0.5 |
| T5 | `seed.sql` + `pnpm db:seed` (A) | 0.2 |
| T6 | `tests/rls` por senha (B): cross-tenant select/insert/update/delete, sem membership, corretor não altera papel, admin altera, ninguém se insere, último admin protegido, outbox | 0.3, 0.4, 0.5 |
| T7 | `db:types` + clientes Supabase em `packages/db` | typecheck |
| T8 | Login OTP 6 dígitos (e-mail padrão do Supabase; template do e-mail deve mostrar `{{ .Token }}`), `proxy.ts`, seleção de tenant, logout | manual + e2e básico |
| T9 | Convite (C) + auditoria | 0.5 |
| T10 | `tokens.css` @theme + next/font | 0.7 |
| T11 | shadcn init tematizado + shell | 0.7 |
| T12 | Componentes base + `/dev/ui`, reduced-motion | 0.7 |
| T13 | Worker: pg-boss, shutdown, pino, relay da outbox, `system.ping` (3 retries, backoff exponencial) | 0.8 |
| T14 | `enqueue()` → outbox (D) | 0.8 |
| T15 | Integração: web→outbox→pg-boss, falha 1x, retry ok, duplicado não reenfileira | 0.8 |
| T16 | ROADMAP, correções F nos docs, CLAUDE.md, `/revisar-fase 0` | DoD |

Ordem: T1 → T2 → T3–T7 → T8, T9 → T10–T12 → T13–T15 → T16.

## 7. Verificação ponta a ponta
Migrations aplicadas no chavi-dev e advisors sem alerta crítico → `pnpm db:seed` → `pnpm test:rls` (chavi-dev) → `pnpm lint && pnpm typecheck && pnpm test` → `pnpm dev`, login OTP (código chega no e-mail real, limite baixo do SMTP padrão), `/dev/ui`, `system.ping` falha 1x e passa → CI verde (Supabase local no runner).

Critério 0.2 (`supabase db reset` com seed de 2 tenants) é verificado no CI, não na máquina do fundador.
