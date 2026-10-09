# Decisões

Formato: contexto curto, decisão, consequências. Novas decisões entram no fim com a data.

## ADR-001: Supabase + Next.js + worker com pg-boss (2026-10-08)
**Contexto:** time pequeno, multi-tenant obrigatório, pouca vontade de operar infraestrutura.
**Decisão:** Postgres do Supabase com RLS para isolamento, Supabase Auth e Storage, Next.js para
web e webhooks, worker Node separado consumindo pg-boss no mesmo banco.
**Consequências:** uma única base de dados para tudo; o worker precisa da conexão direta
(não a do pooler em modo transação) para o pg-boss funcionar. Confirmar na documentação.

## ADR-002: WhatsApp via Evolution API, atrás de um adaptador (2026-10-08)
**Contexto:** o fundador já tem Evolution API e é parceiro Meta. A Evolution API v2 aceita
`WHATSAPP-BUSINESS` (API oficial) e `WHATSAPP-BAILEYS` (QR Code, não oficial) como integração
da instância.
**Decisão:** usar Evolution API v2 como gateway, sempre atrás da interface `WhatsAppGateway`.
**Preferir a integração `WHATSAPP-BUSINESS`** para o número da imobiliária. Baileys só em número
de teste ou descartável, nunca no número principal, e só com leads que iniciaram a conversa.
**Consequências:** regras de janela de 24 h e templates valem na integração oficial; o gateway
aplica essas regras independentemente do modo. Trocar para a Cloud API direta no futuro = novo
adaptador, sem mexer no domínio.

## ADR-003: LLM conversa e extrai; regras classificam (2026-10-08)
**Contexto:** a classificação precisa ser explicável ao corretor e auditável.
**Decisão:** o LLM gera a resposta ao lead e extrai campos estruturados. O `RulesScorerV1`
(código puro) decide a temperatura e gera os motivos exibidos em "Por que é quente?".
**Consequências:** dá para testar a classificação sem LLM; um modelo de scoring externo pode
ser plugado depois na mesma interface `LeadScorer`.

## ADR-004: Dinheiro em centavos, percentuais em basis points (2026-10-08)
**Decisão:** `bigint` de centavos no banco; percentuais inteiros em basis points (1% = 100);
divisões com método do maior resto.

## ADR-005: Interface mostra status, não pontuação (2026-10-08)
**Contexto:** feedback do fundador nos mockups: "se ele é quente, não preciso saber a temperatura".
**Decisão:** UI exibe só Quente / Morno / Frio / Em triagem / Fora do perfil. Pontos internos
do scorer ficam só em `ai_decisions`.

## ADR-006: Web não usa pg-boss; jobs passam por outbox (2026-10-08)
**Contexto:** o pg-boss precisa de conexão direta ou session pooler (nunca o pooler em modo
transação, porta 6543), e a web não deve manter essa conexão nem usar privilégios elevados.
O README do pg-boss não documenta compatibilidade com poolers.
**Decisão:** a web grava jobs na tabela `job_outbox` (com `tenant_id` e RLS) pelo helper
`enqueue()` em `packages/db`, com `tenantId` obrigatório. O worker lê a outbox e chama
`boss.send` com `singletonKey` igual ao id da outbox, marcando `enqueued_at`. O worker usa
`DATABASE_URL_DIRECT`, que em dev aponta para o session pooler (porta 5432) do chavi-dev; o env
Zod rejeita a porta 6543. Produção poderá usar conexão direta, se a hospedagem tiver IPv6. O schema
`pgboss` não tem grants para `anon` nem `authenticated`.
**Consequências:** enfileirar a partir da web é transacional com RLS e idempotente; há um passo
extra (relay) e pequena latência. Eventos externos (`webhook_events`) seguem o mesmo princípio.

## ADR-007: Convite é o único uso de service role acionado por usuário (2026-10-08)
**Contexto:** convidar usuário exige a API admin do Supabase Auth, que usa service role.
**Decisão:** o código vive só em `packages/db/src/server-only/admin-invite.ts`
(`import 'server-only'`). Antes de usar o service role, o módulo confirma com o cliente RLS que o
chamador é admin ativo do tenant alvo, valida a entrada com Zod, e depois grava `audit_log`
(ator, tenant, papel, e-mail mascarado). Regra de lint (`no-restricted-imports`) impede importar
service role fora desse módulo, do worker e dos scripts.
**Consequências:** a regra 1 do CLAUDE.md fica com uma exceção única, auditada e testável.
`memberships` não tem policy de INSERT para `authenticated`.

## ADR-008: Testes de RLS autenticam por senha dos usuários de teste locais (2026-10-08)
**Contexto:** os testes precisam agir como cada usuário do seed sem usar service role.
**Decisão:** `signInWithPassword` com usuários de teste criados por `pnpm db:seed` (API admin),
usando cliente com anon key e o JWT retornado. Service role só no setup/teardown para contagens
de controle. Localmente os testes rodam contra o projeto de nuvem chavi-dev e limpam o que
criam; no CI rodam contra Supabase local. O seed e os testes recusam rodar se o project ref
não for `SUPABASE_DEV_PROJECT_REF` (ou localhost com `CI=true`). Documentado em `tests/rls/README.md`.
**Consequências:** não depende do segredo JWT; senhas existem só em bancos de dev/teste.
Login real do produto é por OTP de 6 dígitos por e-mail, sem senha.

## ADR-009: Tailwind 4 com tokens em CSS `@theme`, sem preset (2026-10-08)
**Contexto:** Tailwind 4 usa configuração CSS-first; não há `tailwind.config.js` nem preset.
**Decisão:** `packages/config/tokens.css` exporta os tokens do `docs/DESIGN.md` em `@theme` e
`apps/web/app/globals.css` o importa depois de `@import "tailwindcss"`. Onde a documentação diz
"preset", leia-se "tokens CSS `@theme`".
**Consequências:** ARCHITECTURE.md, DESIGN.md, `.claude/rules/frontend.md` e o prompt 0.4 serão
corrigidos na T16. No Next 16 o arquivo `middleware` chama-se `proxy` (`apps/web/proxy.ts`).

## ADR-010: Dev em Supabase de nuvem (chavi-dev), migrations por arquivo e SMTP próprio antes do piloto (2026-10-09)
**Contexto:** a máquina do fundador não tem Docker, então não há Supabase local. Existe um projeto
de nuvem só de desenvolvimento, `chavi-dev` (ref `vvdossmsqeiimhwousjf`), acessado pelo MCP do
Supabase. O MCP enxerga a organização inteira, não só esse projeto. Produção será outro projeto.
**Decisão:**
- Toda mudança de schema nasce como arquivo em `supabase/migrations/` e só depois é aplicada com
  `apply_migration`. Nunca se altera schema sem o arquivo correspondente.
- Depois de cada migration, rodam os advisors de segurança do Supabase pelo MCP e os alertas são
  mostrados ao fundador antes de continuar.
- Toda chamada ao MCP e todo script usam apenas o ref do chavi-dev (`SUPABASE_DEV_PROJECT_REF`);
  `db:seed` e `test:rls` recusam outro ref. Tipos vêm do MCP ou de `supabase gen types --project-id`.
- O CI (GitHub Actions, Linux) segue usando Supabase local (`supabase start`).
- O login por OTP usa em dev o e-mail padrão do Supabase, que tem limite baixo de envios e
  remetente genérico.
**Consequências:** **antes do piloto (fim da Fase 4) é obrigatório configurar SMTP próprio**
(remetente do domínio da imobiliária, SPF/DKIM) e revisar os templates de e-mail. Sem `db reset`
em nuvem, o seed precisa ser idempotente e os testes limpam o que criam. Critério 0.2 de
VALIDATION.md é verificado no CI.

## ADR-011: TypeScript 6.0.3 até o typescript-eslint suportar o 7 (2026-10-09)
**Contexto:** a última versão do TypeScript é a 7.0.2, mas o `typescript-eslint` 8.71.1 declara
`typescript >=4.8.4 <6.1.0` como peer.
**Decisão:** fixar `typescript` em 6.0.3 (última 6.0.x) em todos os pacotes.
**Consequências:** revisitar quando o typescript-eslint suportar o TypeScript 7; trocar versão e
rodar lint, typecheck e testes. Versões ficam fixas (sem `^`) para builds reproduzíveis.

## ADR-012: Scripts de instalação do pnpm 11 só para dependências liberadas (2026-10-09)
**Contexto:** o pnpm 11 não executa scripts de instalação (postinstall) de dependências sem
decisão explícita, o que reduz o risco de cadeia de suprimentos.
**Decisão:** `allowBuilds` em `pnpm-workspace.yaml`: `esbuild: true` (usado por vitest e tsx) e
`unrs-resolver: false` (o binário vem por dependência opcional). Toda dependência nova com script
de instalação exige decisão explícita e registro aqui.
**Consequências:** `pnpm install` falha ou avisa quando surgir dependência sem decisão; não
liberar em bloco.

## ADR-013: Chaves do Supabase no formato publishable/secret (2026-10-09)
**Contexto:** o projeto chavi-dev oferece chaves novas (`sb_publishable_...`, `sb_secret_...`) e
as legadas `anon`/`service_role`. As novas são o padrão atual do Supabase.
**Decisão:** usar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. O Zod exige os
prefixos `sb_publishable_` e `sb_secret_`, o que impede colocar a secret em variável pública por
engano. Onde os documentos dizem "service role", leia-se "chave secret"; a regra 1 do CLAUDE.md
e o ADR-007 valem do mesmo jeito. O fundador preenche `.env.local`; o assistente não o lê.
**Consequências:** as chaves legadas não são usadas e podem ser desativadas no painel depois.

## ADR-014: `tenants.settings` nunca guarda segredos (2026-10-09)
**Contexto:** a política `tenants_select` deixa todo membro ativo do tenant ler a linha inteira,
inclusive `settings`.
**Decisão:** `tenants.settings` guarda só configuração não sensível (limites do scorer, perguntas
da triagem, SLA etc.). Credenciais de integração (Evolution API, tokens da Meta, chaves de
provedores) ficam numa tabela própria, com `tenant_id` e RLS habilitado, **sem nenhum privilégio
de leitura para `authenticated`**; só o worker (chave secret) lê. A tela de configuração grava a
credencial por server action e nunca a devolve ao browser (no máximo um indicador "configurado").
**Consequências:** a tabela de credenciais nasce na Fase 1 junto com o `EvolutionAdapter`, com
teste em `pnpm test:rls` provando que nenhum papel a lê.

## ADR-015: audit_log sobrevive à exclusão do tenant e não guarda dado pessoal (2026-10-09)
**Contexto:** na primeira migration, `audit_log.tenant_id` era FK para `tenants` com
`on delete cascade` e a auditoria de memberships gravava a linha inteira (`to_jsonb`). Apagar um
tenant apagava todo o histórico dele, e qualquer coluna nova com dado pessoal entraria no log.
**Decisão:**
- `audit_log.tenant_id` continua obrigatório e indexado, mas **sem FK**: o histórico continua
  existindo depois que o tenant é apagado. Essas linhas ficam legíveis só pela chave secret
  (nenhum usuário é mais admin do tenant apagado).
- A exclusão do tenant é registrada (`entity = 'tenants'`, `action = 'delete'`, com nome e slug
  da empresa), assim como a remoção em cascade das memberships.
- `before`/`after` são montados com **allowlist de campos por entidade** (memberships: `role`,
  `active`). Proibido `to_jsonb(linha)` em função de auditoria.
- Rede de proteção: a constraint `audit_log_no_personal_data` recusa chaves como `email`,
  `phone_e164`, `full_name`, `renda`, `income_cents` e `cpf` no primeiro nível de `before`/`after`.
- Identificadores (`user_id`, `actor_id`, `entity_id`) podem ficar: não são dado de contato.
**Consequências:** toda nova função de auditoria lista os campos explicitamente; a lista da
constraint cresce junto com o schema (ex.: campos de lead na Fase 1). Exclusão de titular (LGPD,
Fase 4) não precisa reescrever o audit_log, porque ele não guarda dado pessoal.

## ADR-016: Relay transacional da outbox, testes em PGlite, fontes locais e pg-boss 12.37.0 (2026-10-09)
**Contexto:** T10 a T15 da fase 0 pedem decisões que o plano não fechava.
**Decisão:**
- O relay da outbox (`apps/worker/src/outbox-relay.ts`) lê as linhas `pending` com
  `for update skip locked` e chama `boss.send` **na mesma transação** que marca a linha como
  `enqueued` (`db` por chamada). O job usa o id da outbox como `id` e `singletonKey`, então uma
  linha relida é recusada pelo pg-boss (`send` devolve `null`) e só é marcada. Falha ao enfileirar
  incrementa `attempts`, guarda `last_error` (truncado), adia `run_after` e, na 5ª falha, vira `failed`.
- O teste de integração do critério 0.8 roda em **PGlite** (Postgres em WASM suportado pelo pg-boss),
  com a tabela `job_outbox` extraída das migrations. Não cobre concorrência real entre dois workers
  (PGlite tem uma conexão só); isso fica para teste contra Postgres de verdade antes do piloto.
- Fontes (Bricolage Grotesque, Geist, Geist Mono) vêm dos pacotes npm `@fontsource-variable/*`
  (OFL), copiadas para `apps/web/app/fonts` e carregadas com `next/font/local`: nenhuma chamada ao
  Google Fonts em build ou runtime.
- Componentes de UI escritos à mão no padrão shadcn (cva + `cn` + Radix Slot), com `components.json`
  pronto. `shadcn init` baixa do registry de ui.shadcn.com; trocar por `shadcn add` quando houver
  autorização para esse acesso.
- `pg-boss` fixado em 12.37.0 (a 12.37.1 tinha menos de 1 dia e a política de idade mínima do
  pnpm a recusa); `lucide-react` em 1.48.0 pelo mesmo motivo.
- Migration `20261010000000_pgboss_schema_hardening.sql` cria o schema `pgboss` sem grants para
  `anon`/`authenticated` (ADR-006). **Ainda não aplicada no chavi-dev.**
- Linha `failed` da outbox guarda `last_error` (truncado a 300 caracteres, sem payload) e volta a
  `pending` com `pnpm jobs:replay --id <uuid>` ou `--failed [--tenant <uuid>]`. O replay só toca
  em linhas `failed`; o erro antigo fica até o relay ter sucesso. Job que falha depois de
  enfileirado é estado do pg-boss, fora desse comando.
- O job de RLS do CI roda `test:concurrency`: dois workers (dois pg-boss e dois relays) na mesma
  outbox, em Postgres real. A migration de hardening também revoga grants de objetos já existentes,
  então funciona qualquer que seja a ordem entre migration e primeiro start do worker.
**Consequências:** reaplicar `apply_migration` no chavi-dev e rodar os advisors antes de usar o
worker contra a nuvem; revisitar o pg-boss 12.37.x e o lucide quando passarem da idade mínima.

---

## Perguntas em aberto (responder antes da fase indicada)

| # | Pergunta | Fase | Resposta |
|---|---|---|---|
| Q1 | Nome definitivo do produto | 4 | |
| Q2 | Quais perguntas exatas a IA faz e em que ordem? (validar com o Pedro) | 2 | |
| Q3 | O que é "quente" na prática? Renda mínima, entrada mínima, prazo máximo | 2 | |
| Q4 | Horário em que a IA atende: 24 h ou só fora do expediente? | 2 | |
| Q5 | Qual modelo Claude usar na conversa (custo × qualidade)? Testar Haiku e Sonnet no eval | 2 | |
| Q6 | SLA padrão de 1º contato (sugestão: 10 min em horário comercial) | 3 | |
| Q7 | Corretor vê leads não atribuídos? | 3 | |
| Q8 | Redistribuição automática ligada por padrão? | 3 | |
| Q9 | Quem acessa o quê: papéis de gerente, corretor e financeiro | 4 | |
| Q10 | Lista de motivos de perda | 4 | |
| Q11 | Regras de comissão: percentual, beneficiários, divisão, gatilho de liberação | 6 | |
| Q12 | Texto de consentimento LGPD (revisar com advogado) | 1 | |
