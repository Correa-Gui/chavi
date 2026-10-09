# Relatório da noite (T10 a T15)

Branch `noite/fase-0-ui-worker`, PR #1 para a `main` (sem merge, sem push na main).
Não acessei o Supabase chavi-dev nem outro serviço externo além de npm e GitHub. Nenhuma
migration existente foi alterada.

## O que foi feito

| Tarefa | Entrega |
|---|---|
| T10 | `packages/config/tokens.css` (`@theme` com cores, status, escala de texto, raios, easing e keyframes do DESIGN.md, mais regra global de `prefers-reduced-motion`). Fontes locais (Bricolage, Geist, Geist Mono) via `next/font/local`. Teste de contraste ≥ 4.5:1 para os 16 pares texto/fundo dos tokens. |
| T11 | Shell: menu lateral escuro, painel areia com 10 px de margem e raio 24, contador laranja, card "IA atendendo agora". No celular o menu vira faixa no topo. `components.json`, `cn()`, `Button` (variantes, alvo ≥ 44 px em toque). |
| T12 | Componentes: `StatusBadge` (com brilho em "Em triagem"), `Avatar`, `Card` (hover sobe 3 px), `KpiCard` + `CountUp` (contagem 0 → valor em 1,1 s), `Reveal` (entrada em cascata), `ChatBubble`, `TypingDots`, `PulseDot`, `ProgressBar`, `Input`, `Skeleton`, `EmptyState`. Galeria em `/dev/ui` (404 em produção). Motion reduzido: CSS global zera animações e os componentes Motion renderizam sem animar. |
| T13 | Worker: pg-boss (schema `pgboss`), pool próprio para o relay, `system.ping` (3 retries, backoff exponencial), shutdown gracioso (relay, depois `boss.stop` com 30 s, depois pool), logs pino com `tenantId`/`jobId`/`outboxId`. `OUTBOX_POLL_MS` opcional. |
| T14 | `enqueue(client, { tenantId, name, payload, runAfter })` em `packages/db`: Zod, lista fechada de jobs, resultado tipado (sem lançar), usa o cliente RLS do usuário. Teste confere que `JOB_NAMES` bate com a constraint da migration. |
| T15 | Teste de integração (`outbox.integration.test.ts`): linha na outbox → relay → pg-boss → `system.ping` falha na 1ª tentativa → retry → completo (`retryCount = 1`); linha já enfileirada não é relida; linha que volta a `pending` não gera segundo job (pg-boss recusa o `id` duplicado); `run_after` futuro é respeitado. Rodei 3 vezes seguidas, sem flakiness. |

Também: ROADMAP (itens "Tokens + shell" e "Worker com pg-boss" marcados) e ADR-016 em `DECISIONS.md`.

## O que ficou pendente e por quê

- **Conferência visual do `/dev/ui`**: duas instâncias do Chrome estavam conectadas e a ferramenta
  exige que você escolha qual usar, então não tirei screenshot. Verifiquei só por build, tipos,
  testes e `curl` (200, textos presentes). Falta olhar a página (inclusive a 390 px).
- **Migration `20261010000000_pgboss_schema_hardening.sql` não aplicada no chavi-dev** (regra: sem
  acesso à nuvem). Aplique com `apply_migration` e rode os advisors antes de subir o worker contra
  a nuvem. No CI ela já roda via `supabase db reset`.
- **Worker contra o chavi-dev não foi executado** (precisa de `DATABASE_URL_DIRECT`). Foi provado só
  em PGlite. Falta um teste com dois workers concorrentes em Postgres de verdade
  (`skip locked`); recomendo antes do piloto.
- **Itens da fase 0 que não eram do meu escopo e seguem abertos**: login OTP e convite (T8, T9),
  T16. O menu do shell aponta para `/leads`, `/funil` e `/configuracoes`, que ainda dão 404
  (telas da fase 4).
- `shadcn init`/`shadcn add` não foram usados (baixam do registry ui.shadcn.com, serviço externo).

## Decisões minhas que precisam da sua validação

1. **Componentes escritos à mão no padrão shadcn**, em vez do CLI (motivo acima). `components.json`
   está pronto para você rodar `shadcn add` depois, se quiser.
2. **Fontes servidas localmente** a partir dos pacotes `@fontsource-variable/*` (licença OFL),
   sem Google Fonts. Só o subconjunto latin (cobre português).
3. **pg-boss 12.37.0 em vez de 12.37.1** e **lucide-react 1.48.0 em vez de 1.53.0**: as versões
   mais novas tinham menos de 1 dia e a política `minimumReleaseAge` do pnpm as recusa. Não
   relaxei a política. Revisitar em alguns dias.
4. **Relay transacional**: `boss.send` e a marcação `enqueued` na mesma transação; `id` e
   `singletonKey` do job = id da outbox. Após 5 falhas a linha vira `failed` (backoff de 10 s × n).
   Se preferir outro limite ou alerta para `failed`, é regra de negócio sua.
5. **`system.ping` aceita `failFirstAttempts` no payload** para provar o retry (critério 0.8).
   Está na lista fechada de jobs da web; pode sair quando houver job real.
6. **Testes de integração em PGlite**: não cobrem concorrência. Registrado no ADR-016.
7. `agentRules: false` no `next.config.ts`: o `next dev` gerava um `AGENTS.md` em `apps/web`.

## Como ver o resultado rodando

Pré-requisito: `pnpm install`.

```bash
# Só a web (basta para /dev/ui; não exige .env.local do Supabase)
pnpm --filter @chavi/web dev
# abrir http://localhost:3000/dev/ui   (testar também a 390 px e com "reduzir movimento" ligado)

# Qualidade (tudo passa localmente)
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Só os testes do worker, incluindo a integração do critério 0.8
pnpm --filter @chavi/worker test

# Web + worker juntos (o worker exige SUPABASE_URL, SUPABASE_SECRET_KEY e
# DATABASE_URL_DIRECT no .env.local; antes aplique a migration de hardening no chavi-dev)
pnpm dev
```

A web sem `.env.local` roda porque as variáveis do Supabase só são exigidas por quem usa o
cliente (a tela de login, na T8).
