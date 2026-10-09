# Plano: Marco Demo (entre a Fase 0 e a Fase 1)

## Contexto
O fundador quer mostrar o Chavi a um cliente antes da Fase 1. Entrega: site e worker publicados,
login, as três telas do mockup com dados fictícios e uma fatia real de WhatsApp. A mensagem chega
pela Evolution API, a IA faz a triagem com as perguntas do mockup (renda, vínculo, FGTS, entrada,
prazo), o `RulesScorerV1` classifica e o lead aparece no painel e na ficha com a conversa.
Não é código descartável: tabelas, interfaces (`WhatsAppGateway`, `LeadScorer`, `TriageEngine`,
`LlmClient`) e regras do `docs/ARCHITECTURE.md`, em versão enxuta das Fases 1, 2 e 4. RLS e
testes de isolamento valem igual.
Fora do escopo: simulador, CSV, distribuição, SLA, convite (T9), inatividade da triagem.

## Decisões do fundador (2026-10-09)
| Tema | Decisão | Consequência / ADR |
|---|---|---|
| WhatsApp | Evolution 2.3.x, integração **WHATSAPP-BAILEYS**, **número de teste** | ADR-002 respeitado (Baileys só em número de teste). O gateway aplica opt-out e janela de 24 h mesmo sem templates |
| Hospedagem | **VPS KVM na Hostinger**, domínio próprio; Evolution **na mesma VPS** | ADR-017: Docker Compose (Caddy + web + worker) em vez de Vercel/Railway |
| LLM | **OpenAI**; o fundador informa o modelo (`OPENAI_MODEL`) | ADR-018: provedor atrás do `LlmClient`; atualizar ARCHITECTURE §2/§7. Confiro na doc se o modelo aceita Structured Outputs |
| Banco | **chavi-dev** também serve a demo | Tenant de apresentação separado dos tenants de teste (ver riscos) |
| Scorer | Limites padrão propostos (renda, vínculo, prazo) em `tenants.settings.scoring`, em centavos | Responde Q3 provisoriamente; registrar em DECISIONS |
| Consentimento | Texto **v0-rascunho**, versionado e gravado no lead | Pendência obrigatória antes do piloto (Q12) |
| Variáveis | Mantêm os nomes atuais do `.env`; só acrescento as novas | Lista abaixo. Fundador preenche; eu não leio |

## Pesquisa (fontes)
- **Webhook Evolution v2.3.7** (código-fonte `evolution-foundation/evolution-api@2.3.7`):
  - Configuração: `POST /webhook/set/{instance}` com header `apikey` e corpo
    `{ webhook: { enabled, url, headers, byEvents, base64, events: ['MESSAGES_UPSERT'] } }`. Aceita **headers customizados**: uso `x-chavi-webhook-secret`.
  - Corpo enviado: `{ event, instance, data, destination, date_time, sender, server_url, apikey }`. **Atenção: `apikey` vem no corpo.** Removo antes de gravar e nunca logo.
  - `data` (Baileys): `key { remoteJid, fromMe, id, remoteJidAlt?, addressingMode? }`, `pushName`, `message.conversation` (`extendedTextMessage` já é convertido em `conversation`), `messageType`, `messageTimestamp` (segundos), `instanceId`, `source`. Quando `remoteJid` é `@lid` e existe `remoteJidAlt`, a Evolution já troca pelo número.
  - Envio de texto: `POST /message/sendText/{instance}`, header `apikey`, corpo `{ number, text, delay?, linkPreview? }`.
- **OpenAI SDK** (`openai@7.31.0`, Node ≥ 22, peer `zod ^3.25 || ^4`):
  - `client.responses.parse({ model, input, text: { format: zodTextFormat(Schema, 'triage') } })`, resultado em `output_parsed`.
  - Tratar `refusal` e `status: 'incomplete'`. Campos opcionais como `.nullable()`, todos em `required`.
  - Fonte: https://developers.openai.com/api/docs/guides/structured-outputs
  - Usar `store: false` (LGPD); confirmar o parâmetro na referência ao implementar.
- **Next.js 16 em VPS**: `output: 'standalone'` + `outputFileTracingRoot` = raiz do monorepo. Copiar `public` e `.next/static`; rodar `server.js` com `PORT`/`HOSTNAME`. Fonte: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- **pnpm deploy**: no pnpm 11 exige `injectWorkspacePackages` ou `--legacy` (só o 12.2+ dispensa). Fonte: https://pnpm.io/cli/deploy . Worker: imagem com `pnpm deploy --legacy --prod`; o worker roda `tsx`, porque os pacotes do workspace exportam `.ts`.

## Variáveis de ambiente (novas, além das atuais)
| Variável | Onde | Para quê |
|---|---|---|
| `OPENAI_API_KEY` | worker | LLM |
| `OPENAI_MODEL` | worker | Modelo informado pelo fundador |
| `EVOLUTION_API_URL` | worker, setup | Rede interna do Docker (ex.: `http://evolution-api:8080`) |
| `EVOLUTION_API_KEY` | worker, setup | Header `apikey` da Evolution |
| `EVOLUTION_INSTANCE` | setup | Nome da instância Baileys de teste |
| `EVOLUTION_WEBHOOK_SECRET` | setup | Vai no header do webhook; no banco fica só o **hash** |
| `APP_DOMAIN` | Caddy, setup | Ex.: `app.seudominio.com.br` (DNS A na Hostinger → IP da VPS) |
| `SUPABASE_SECRET_KEY` | web (já existe; passa a ser usada no web) | Só no módulo server-only do webhook (ADR-007 ampliado) |

## Prévia (D0): antes de tudo
1. Revisar e fazer merge do **PR #1** (T10–T15).
2. Aplicar `20261010000000_pgboss_schema_hardening.sql` no chavi-dev e rodar os advisors.
3. Acrescentar o "Marco Demo" no `docs/ROADMAP.md`, entre a Fase 0 e a Fase 1, com os itens D1–D4.
4. Registrar no `DECISIONS.md`: ADR-017 (VPS), ADR-018 (OpenAI), Q3 provisória e consentimento v0.

## D1 · Base de leads, login e tenant da demo
- **Migration**: `lead_sources`, `leads`, `lead_events`, `webhook_events`, `whatsapp_instances` (tenant ↔ instância, `webhook_secret_hash`, `integration`), `conversations` (`wa_jid` para responder ao JID exato), `messages`, `triage_sessions`, `ai_decisions`. Tudo conforme ARCHITECTURE §5.
- **RLS**:
  - Corretor vê leads atribuídos a ele ou sem atribuição; admin e gerente veem todos (ARCHITECTURE §4).
  - `webhook_events`, `whatsapp_instances` e `ai_decisions` não têm leitura para corretor. `ai_decisions` não aparece na UI (ADR-005).
  - Update de lead só nas colunas `stage` e `lost_reason`.
  - Auditoria com lista fixa de campos (rules).
  - Fluxo da migration: arquivo → `apply_migration` → advisors → `db:types`.
- **`packages/core`**:
  - `normalizePhoneBR` para E.164 (critérios 1.1 e 1.2), incluindo o 9º dígito de celular que o WhatsApp às vezes omite no JID.
  - `jidToPhone`.
  - `detectOptOut` ("sair", "parar") e `detectHumanRequest`.
- **Login (T8)**:
  - OTP de 6 dígitos (`signInWithOtp` + `verifyOtp`).
  - `apps/web/proxy.ts` renova a sessão e redireciona.
  - Seleção de imobiliária e logout.
  - O fundador entra no tenant de apresentação por script (`pnpm demo:add-user --email`), sem convite.
- **Tenant de apresentação** "Demo Imóveis" (UUID fixo, fora dos tenants dos testes de RLS) e `pnpm db:seed:demo`:
  - ~25 leads fictícios com conversas, temperaturas, etapas e motivos.
  - Idempotente; recusa outro projeto.
  - Telefones de faixa fictícia; o gateway bloqueia envio a eles (sem janela aberta).
- **Aceite**:
  - `test:rls` cobre as tabelas novas: cross-tenant, corretor × gerente, sem membership (1.9).
  - Testes de unidade de 1.1 e 1.2.
  - Login OTP funciona no chavi-dev.
  - Advisors sem alerta de segurança. CI verde.

## D2 · Mensagem do WhatsApp vira lead
- **`packages/integrations/whatsapp`**:
  - `WhatsAppGateway` e `EvolutionAdapter`:
    - `parseWebhook`: Zod sobre `messages.upsert`. Ignora `fromMe`, grupos (`@g.us`), `@lid` sem `remoteJidAlt` e mídia (registrada como "mensagem não suportada").
    - `sendText`.
  - Envio passa por guarda única: opt-out → janela de 24 h → texto (critério 2.7).
  - Payloads de exemplo em `tests/fixtures/evolution/`, montados a partir do formato da 2.3.7 e substituídos por payload real capturado da instância de teste (sem dados pessoais).
- **Rota `POST /api/webhooks/evolution/[instance]`**:
  - Usa o módulo server-only `packages/db/src/server-only/webhook-ingest.ts`, a 2ª e última exceção do ADR-007. O ESLint libera só esse caminho.
  - Compara o hash do header com `timingSafeEqual`. Sem segredo válido: 401 e nada gravado (1.5).
  - Valida com Zod e limita o tamanho do corpo. Remove `apikey`.
  - Grava em `webhook_events` com chave única (`evolution`, `data.key.id`) e enfileira `whatsapp.ingest` na outbox (migration amplia a lista fechada). Responde 200.
  - Rate limit simples por instância.
- **Worker `whatsapp.ingest`**:
  - Normaliza o telefone e busca o lead por `(tenant_id, phone_e164)`. Se não existe, cria com `stage=triage` e `temperature=pending`.
  - Grava conversa e mensagem (`unique provider_message_id`) e o `lead_event`.
  - Enfileira `triage.step` com `singletonKey = leadId` e pequeno atraso para agrupar mensagens seguidas.
  - Em falha: `webhook_events.status=failed` e retry (1.6).
- **`pnpm demo:setup-whatsapp`**: registra o webhook na instância (URL interna `http://web:3000/...`, header com o segredo, só `MESSAGES_UPSERT`) e grava `whatsapp_instances` com o hash.
- **Aceite**:
  - O mesmo webhook recebido 3 vezes gera 1 lead e 1 mensagem (1.4).
  - 401 sem segredo (1.5).
  - O retry funciona (1.6).
  - O mesmo número com e sem o 9º dígito gera 1 lead.
  - Testes de integração com fixtures. CI verde.

## D3 · Triagem por IA e classificação
- **`packages/integrations/llm`**:
  - `LlmClient` + `OpenAiLlmClient`: `responses.parse` + `zodTextFormat`, timeout, retry com backoff, `store: false`.
  - Saída estruturada `{ reply, extracted: { renda_bruta_cents, vinculo, meses_carteira, tem_fgts, entrada_cents, prazo_meses, regiao_interesse } (todos nullable), wants_human, opted_out }`.
  - Prompts versionados (`triage.v1`). Modelo e versão vêm da configuração.
- **`TriageEngine`** (`packages/core`, puro): `greeting → consent → questions → closing → done`.
  - Apresenta-se como assistente virtual da imobiliária (2.1).
  - Pede consentimento antes da renda (2.2) e grava `consent_at`, `consent_text_version=v0-rascunho` e `legal_basis`.
  - Nunca pede CPF.
  - Limite de mensagens.
  - Pedido de humano → `mode=human`, sem distribuição (fora do escopo): fica na fila "Esperando corretor" (2.5).
  - Opt-out → registra e não envia mais nada (2.6).
- **`LeadScorer` + `RulesScorerV1`** (`packages/core`): limites de `tenants.settings.scoring`. Devolve `{ temperature, reasons[] }` em frases para "Por que é quente?" (ADR-003, ADR-005).
- **Worker `triage.step`**:
  - Carrega o histórico e chama o LLM.
  - Grava `ai_decisions` (modelo, versão do prompt, entrada resumida com dados pessoais mascarados, saída, latência) (2.8).
  - Envia pelo gateway. Ao terminar, classifica e grava o evento.
  - LLM fora do ar: o lead fica "Em triagem" e o job tenta de novo (2.9).
- **`pnpm eval:triage`** (manual, chama a OpenAI): ~10 conversas de exemplo, incluindo casos adversariais de "promete aprovação/parcela/taxa?" (2.10).
- **Aceite**:
  - Testes de unidade da máquina de estados e do scorer.
  - Integração com LLM mockado cobrindo 2.5, 2.6, 2.8 e 2.9.
  - Eval com extração ≥ 8/10 e nenhuma promessa de crédito.
  - Pontuação nunca aparece na UI (2.11).

## D4 · Telas e publicação
- **Telas** (dados via server components e `@chavi/db/server`, RLS):
  - **Painel `/leads`**: KPIs do dia (Quentes hoje, Leads hoje por origem, 1ª resposta da IA, Esperando corretor), fila com filtro por status e busca.
  - **Funil `/funil`**: colunas do mockup, arrastar com `@dnd-kit` (dependência nova, decisão no ADR-012 se tiver script de instalação), "Perdido" exige motivo (lista provisória da Q10), visão "Equipe toda" / "Meus leads".
  - **Ficha `/leads/[id]`**:
    - Cabeçalho do lead.
    - Card "Temperatura do lead".
    - Conversa com "IA digitando" enquanto há `triage.step` ativo.
    - "Por que é quente?".
    - Dados extraídos (renda mostrada em faixa, não valor completo).
    - Registro de consentimento.
    - Botão "Assumir conversa" (`mode=human`, a IA para).
    - O acesso grava `personal_data_access_log`.
  - Estados vazio e de carregamento. 390 px sem rolagem horizontal (4.4).
  - Todo texto em pt-BR, com status em palavras.
- **Publicação na VPS** (`deploy/`):
  - `docker-compose.yml` com `caddy` (TLS automático em `APP_DOMAIN`), `web` (imagem standalone) e `worker`, ligados à rede Docker da Evolution já existente.
  - `deploy.sh`: `git pull` + `docker compose up -d --build`.
  - `/api/health`. Logs JSON do worker via `docker logs`.
  - Segredos num `.env` na VPS, preenchido pelo fundador.
- **SMTP próprio no Supabase Auth (Resend)**, para o código de login chegar rápido e fora do spam:
  - Domínio de envio verificado no Resend (registros SPF, DKIM e DMARC no DNS da Hostinger), ex.: `login@seudominio.com.br`.
  - Supabase > Authentication > SMTP Settings com host, porta, usuário e chave do Resend (preenchidos pelo fundador; a chave não entra no repositório).
  - Template do e-mail de OTP em pt-BR mostrando `{{ .Token }}`. Limite de envio do Auth ajustado para a demo.
  - Antecipa a pendência de SMTP próprio do ADR-010 (que o piloto exige de qualquer forma).
- **Roteiro da demo** em `docs/plans/roteiro-demo.md`: o que mostrar, de qual número mandar mensagem e como resetar.
- **Aceite**:
  - O site abre em `https://APP_DOMAIN` com login OTP; o e-mail do código chega pelo Resend em menos de 1 minuto, na caixa de entrada (não no spam) de Gmail e Outlook.
  - Uma mensagem real enviada ao número de teste vira lead "Em triagem" no painel em < 10 s. A IA conduz as 5 perguntas, o lead termina classificado e a ficha mostra a conversa e os motivos.
  - e2e Playwright de login + telas com dados de seed (4.1 parcial, 4.2, 4.4).
  - CI verde.

## Riscos e mitigação
- **chavi-dev compartilhado**: os testes de RLS alteram e apagam dados temporários. Por isso a demo usa um tenant próprio, intocado pelos testes. Quem tem a senha dos usuários `*.chavi.test` não tem membership nele.
- **Baileys** (não oficial): risco de bloqueio do número. Só número de teste e só quem iniciou a conversa (ADR-002).
- **Dados pessoais enviados à OpenAI**: o consentimento v0 menciona o uso de IA. `store: false`. Logs mascarados. Revisão jurídica antes do piloto.
- **SMTP padrão do Supabase**: limite baixo de e-mails de OTP. Suficiente para a demo; SMTP próprio antes do piloto (ADR-010).

## Verificação ponta a ponta
1. Em cada D: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:rls`, CI verde, advisors depois de cada migration e item do ROADMAP marcado no mesmo commit.
2. D2: `curl` com fixture e segredo errado → 401; com segredo certo, 3 vezes → 1 lead (consulta via MCP).
3. D3: `pnpm eval:triage`; conversa real no número de teste olhando `ai_decisions` pelo MCP.
4. D4: `https://APP_DOMAIN/api/health`; login OTP; mensagem real → painel → ficha; celular a 390 px.
