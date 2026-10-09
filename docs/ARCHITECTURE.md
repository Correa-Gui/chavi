# Arquitetura

## 1. Visão geral

```
 Anúncio Meta (Click to WhatsApp) ─┐
 Simulador de financiamento ───────┤
 Importação CSV / cadastro manual ─┼──► Ingestão ──► Tratamento ──► Triagem IA ──► Scorer ──► Distribuição ──► CRM
 (futuro) Lead Ads, portais ───────┘   (webhook +    (normaliza,    (conversa no    (regras)   (rodízio,       (painel,
                                        fila)         deduplica,     WhatsApp,                   SLA)           funil,
                                                      consentimento) extrai dados)                              ficha)
```

Princípio: **cada etapa é um job independente na fila**, idempotente e com retry. Uma falha
no WhatsApp ou no LLM nunca perde o lead: ele fica "Em triagem" e o job tenta de novo.

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript em tudo | Um time, um idioma, tipos do banco até a tela |
| Monorepo | pnpm workspaces + Turborepo | Compartilhar `core` e `db` entre web e worker |
| Web | Next.js (App Router) + React | Server components, server actions, rotas de webhook |
| UI | Tailwind CSS + shadcn/ui + Motion (`motion/react`) | Componentes prontos e consistentes, animações declarativas |
| Banco/Auth/Storage | Supabase (Postgres + Auth + Storage) | RLS nativo para multi-tenant, auth pronta |
| Fila e jobs | pg-boss no mesmo Postgres | Retry, agendamento (SLA), `singletonKey` para idempotência, sem infra extra |
| Worker | Node (processo separado `apps/worker`) | Consome a fila; container na VPS junto com o web (ADR-017) |
| Validação | Zod | Webhooks, formulários, env |
| LLM | OpenAI (Responses API, Structured Outputs) atrás do `LlmClient` | Conversa de triagem e extração estruturada; provedor trocável (ADR-018) |
| WhatsApp | Evolution API v2 atrás de `WhatsAppGateway` | O fundador já tem; adaptador permite trocar |
| Testes | Vitest, Playwright, testes de RLS contra Supabase local | |
| Logs | pino (JSON) | Estruturado, com `tenantId` |

> Antes de fixar versões, confira a documentação atual de cada ferramenta. Use as versões
> estáveis mais recentes no momento do scaffold.

## 3. Estrutura de pastas

```
apps/
  web/                      Next.js: telas, server actions, rotas /api (webhooks, ingest)
    app/(app)/leads         Painel de leads
    app/(app)/funil         Kanban
    app/(app)/leads/[id]    Ficha do lead
    app/(public)/simulador/[tenantSlug]   Página pública de captura
    app/api/webhooks/evolution/[instance] Webhook do WhatsApp
    app/api/ingest/[tenantSlug]/[source]  Ingestão genérica (formulário/site)
  worker/                   Consumidor pg-boss: jobs de ingestão, triagem, distribuição, SLA
packages/
  core/                     Domínio puro: normalização, dedup, scorer, distribuição, dinheiro, comissão
  db/                       Clientes Supabase, tipos gerados, repositórios
  integrations/
    whatsapp/               WhatsAppGateway + EvolutionAdapter (+ futuro CloudApiAdapter)
    llm/                    LlmClient + OpenAiLlmClient, prompts versionados, extração estruturada
  config/                   eslint, tsconfig, tailwind preset (tokens do DESIGN.md)
supabase/
  migrations/               SQL versionado
  seed.sql                  Tenant de demonstração (imobiliária do fundador, dados fictícios)
tests/
  rls/                      Testes de isolamento entre tenants
  e2e/                      Playwright
docs/                       Este diretório
```

## 4. Multi-tenant e segurança

- `tenants` = imobiliárias. `memberships(user_id, tenant_id, role)` liga usuário a imobiliária.
- Papéis: `admin`, `gerente`, `corretor`, `financeiro` (financeiro só a partir da fase de comissões).
- Função SQL `auth_tenant_ids()` retorna os tenants do usuário logado; toda política RLS usa
  `tenant_id in (select auth_tenant_ids())`.
- Corretor vê **os próprios leads** + leads não atribuídos (configurável); gerente e admin veem
  todos do tenant. Isso também fica em RLS, não só na UI.
- Worker usa service role, mas **sempre** filtra por `tenant_id` explícito vindo do job.
  Repositórios do worker exigem `tenantId` como parâmetro obrigatório.
- Webhooks públicos são autenticados: segredo por instância/tenant no header ou na URL
  (comparação em tempo constante) + validação Zod do payload.

## 5. Modelo de dados (núcleo)

Convenções: `id uuid default gen_random_uuid()`, `tenant_id uuid not null`, `created_at`,
`updated_at`, `deleted_at` (soft delete onde indicado). Enums como tipos Postgres.

```
tenants(id, name, slug unique, settings jsonb, created_at)
memberships(user_id, tenant_id, role, active)              -- PK (user_id, tenant_id)
profiles(user_id, full_name, phone_e164, avatar_url)

lead_sources(id, tenant_id, kind, name, campaign, external_ref)
  kind: whatsapp_ad | simulator | form | csv | manual | referral | portal
leads(id, tenant_id, full_name, phone_e164, email, source_id, campaign,
      property_interest_id null, temperature, stage, assigned_to null,
      assigned_at, first_contact_at, lost_reason null,
      consent_at, consent_text_version, legal_basis, opted_out_at null,
      deleted_at)
  temperature: pending | hot | warm | cold | out_of_profile
  stage: new | triage | qualified | visit | credit_analysis | won | lost
  unique (tenant_id, phone_e164) where deleted_at is null      -- base da deduplicação
lead_events(id, tenant_id, lead_id, type, actor_type, actor_id, data jsonb, created_at)
  -- linha do tempo: criado, mesclado, mensagem, classificado, atribuído, etapa_alterada...

conversations(id, tenant_id, lead_id, channel, status, mode,
              window_expires_at, last_inbound_at, wa_instance)
  mode: ai | human     status: open | closed
messages(id, tenant_id, conversation_id, direction, sender, body, media_url,
         provider_message_id, status, created_at)
  unique (tenant_id, provider_message_id)
triage_sessions(id, tenant_id, lead_id, conversation_id, state, answers jsonb,
                questions_asked int, started_at, finished_at)
ai_decisions(id, tenant_id, lead_id, kind, model, prompt_version,
             input_summary jsonb, output jsonb, latency_ms, created_at)
  kind: extraction | classification | reply

distribution_rules(id, tenant_id, strategy, config jsonb, active)
  strategy: round_robin | manual  (região/tipo/faixa de preço depois)
sla_policies(id, tenant_id, first_contact_minutes, auto_reassign bool)
assignments(id, tenant_id, lead_id, user_id, reason, created_at)

tasks(id, tenant_id, lead_id, assignee_id, kind, due_at, done_at, notes)
  kind: call | visit | follow_up | other

webhook_events(id, tenant_id null, provider, external_id, payload jsonb,
               status, attempts, last_error, received_at, processed_at)
  unique (provider, external_id)
audit_log(id, tenant_id, actor_id, entity, entity_id, action, before jsonb, after jsonb, at)
personal_data_access_log(id, tenant_id, actor_id, lead_id, purpose, at)

-- Pós-MVP (deixar só planejado, não criar antes da fase):
properties, property_owners, property_photos, deals,
commission_rules, commission_splits, commission_entries, commission_entry_history
```

## 6. Fluxos principais

### 6.1 Lead novo pelo WhatsApp (anúncio Click to WhatsApp)
1. Evolution chama `POST /api/webhooks/evolution/[instance]`.
2. Rota valida segredo + Zod, grava em `webhook_events` (ignora duplicado) e enfileira
   `ingest.whatsapp` com o id do evento. Responde 200 rápido.
3. Worker: normaliza telefone (E.164), busca lead por `(tenant_id, phone_e164)`.
   Novo → cria lead (`stage=triage`, `temperature=pending`), registra origem (dados de
   referência do anúncio, se vierem no payload) e evento. Existente → anexa mensagem.
4. Enfileira `triage.step` para o lead.

### 6.2 Triagem
- `TriageEngine` é uma máquina de estados: `greeting → consent → questions → closing → done`.
- Cada passo: carrega histórico, chama o LLM com o prompt versionado, recebe **resposta ao lead +
  campos extraídos** (tool use / saída estruturada), salva `ai_decisions`, envia mensagem pelo
  `WhatsAppGateway`.
- Perguntas padrão (configuráveis por tenant): renda bruta familiar, tipo de vínculo
  (CLT/autônomo/servidor), tempo de carteira/FGTS, valor de entrada, prazo para comprar,
  região/imóvel de interesse. Restrição no CPF **não** é perguntada pela IA; fica para o corretor.
- Encerra quando todas as respostas obrigatórias chegaram, o lead pede humano, fica inativo
  (job agendado) ou atinge o limite de mensagens. Então chama o `LeadScorer`.
- A qualquer momento: "falar com corretor" → `mode=human` e distribuição imediata.

### 6.3 Classificação
```ts
interface LeadScorer {
  readonly version: string;
  score(input: TriageAnswers, ctx: TenantScoringConfig): {
    temperature: 'hot' | 'warm' | 'cold' | 'out_of_profile';
    reasons: string[];          // frases curtas exibidas em "Por que é quente?"
  };
}
```
Implementação inicial `RulesScorerV1` (puro, em `packages/core`), com limites configuráveis por
tenant (ex.: renda mínima compatível com o produto). Um scorer externo pode ser plugado depois
sem mudar quem chama.

### 6.4 Distribuição e SLA
- Após classificar `hot`/`warm`: `distribution.assign` aplica a regra do tenant (rodízio entre
  corretores ativos, ou manual = fila "Distribuir").
- Agenda `sla.check` para `now + first_contact_minutes`. Se o corretor não registrou contato
  (mensagem humana enviada, ligação marcada ou "Assumir conversa"), alerta o corretor e o
  gerente; se `auto_reassign`, redistribui e registra em `assignments`.

## 7. Interfaces de integração

```ts
interface WhatsAppGateway {
  sendText(p: { tenantId: string; instance: string; to: string; text: string }): Promise<SendResult>;
  sendTemplate(p: { tenantId: string; instance: string; to: string; template: string; vars: string[] }): Promise<SendResult>;
  parseWebhook(raw: unknown): ParsedInbound[];   // normaliza o payload do provedor
}
```
- `EvolutionAdapter`: Evolution API v2. A instância pode usar a integração `WHATSAPP-BUSINESS`
  (API oficial, **preferida**) ou `WHATSAPP-BAILEYS` (QR Code, não oficial). Ver ADR-002.
- `LlmClient`: encapsula o provedor de LLM (hoje OpenAI, ADR-018). Modelo e versão do prompt vêm de configuração,
  nunca fixos no código de domínio. Timeout, retry com backoff e fallback para "triagem pausada".

## 8. Observabilidade
- Logs JSON com `tenantId`, `leadId` (id, não dados pessoais), `jobId`, `durationMs`.
- `webhook_events` e a fila do pg-boss são a trilha de reprocessamento: um script
  `pnpm jobs:replay --event <id>` reenfileira um evento.
- Métricas mínimas no painel interno: leads por origem, tempo até 1ª resposta da IA,
  taxa de conclusão da triagem, falhas por integração.
