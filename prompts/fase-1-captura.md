# Fase 1: Captura e tratamento

---

## 1.1 · Plano da fase
**Modelo:** `opus` · **Esforço:** `high` · **Modo:** plano

```
Leia CLAUDE.md, docs/ARCHITECTURE.md (seções 5, 6.1 e 7), docs/VALIDATION.md (fase 1) e
docs/DECISIONS.md (ADR-002).

Pesquise na documentação atual da Evolution API v2:
- formato do webhook de mensagem recebida (evento, campos de remetente, texto, id da mensagem);
- se o payload traz dados de referência do anúncio Click to WhatsApp e em que campo;
- como configurar o webhook por instância e como autenticá-lo;
- diferenças de comportamento entre as integrações WHATSAPP-BUSINESS e WHATSAPP-BAILEYS.
Cite as fontes. Se algo não estiver documentado, diga isso em vez de supor.

Depois proponha as tarefas da fase, a migration (leads, lead_sources, lead_events,
webhook_events) e os tipos do WhatsAppGateway. Espere minha aprovação.
```

---

## 1.2 · Normalização e deduplicação
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Em packages/core, implemente (código puro, sem banco):
- normalizePhoneBR(input): resultado tipado com E.164 ou motivo de erro. Use libphonenumber-js.
  Trate DDD, nono dígito, +55, espaços, parênteses e traços.
- normalizeEmail(input).
- findDuplicate / mergeLeads: regra de deduplicação por (tenant, telefone) e, como reforço,
  por e-mail; a mesclagem mantém o registro mais antigo e junta as origens.
- maskPhone / maskEmail para logs.
Testes cobrindo os critérios 1.1 e 1.2 de docs/VALIDATION.md e casos estranhos (fixo, número
estrangeiro, vazio, com letras).
```

---

## 1.3 · Tabelas de lead e ingestão idempotente
**Modelo:** `sonnet` · **Esforço:** `high`

```
1. Migration com leads, lead_sources, lead_events e webhook_events conforme
   docs/ARCHITECTURE.md seção 5, com RLS e índice único parcial de telefone por tenant.
   Acrescente os testes em pnpm test:rls (critério 1.9).
2. Serviço de ingestão em packages/db: recebe (tenantId, origem, dados brutos), normaliza,
   deduplica, cria ou atualiza o lead e grava o evento. Tudo em uma transação.
3. Rota POST /api/ingest/[tenantSlug]/[source] para formulários: segredo por tenant, Zod,
   rate limit, grava webhook_events e enfileira o job "ingest.generic".
4. Job "ingest.generic" no worker usando o serviço.
Testes de integração para os critérios 1.3, 1.5 e 1.6.
```

---

## 1.4 · WhatsApp: gateway e webhook da Evolution
**Modelo:** `sonnet` · **Esforço:** `high`

```
Usando o que foi levantado no plano 1.1 sobre a Evolution API v2:
1. Em packages/integrations/whatsapp: interface WhatsAppGateway (docs/ARCHITECTURE.md seção 7)
   e EvolutionAdapter com sendText, sendTemplate e parseWebhook. Base URL, API key e instância
   vêm da configuração do tenant (tabela de configuração criptografada ou env por enquanto).
2. O gateway recusa texto livre fora da janela de atendimento (critério 2.7 já fica pronto).
3. Rota POST /api/webhooks/evolution/[instance]: autentica, valida, grava webhook_events,
   enfileira "ingest.whatsapp", responde 200 rápido.
4. Job "ingest.whatsapp": cria ou encontra o lead, salva a origem (incluindo referência do
   anúncio quando existir), registra lead_event. Ainda não responde ao lead: a triagem é a fase 2.
5. Teste com payloads de exemplo salvos em tests/fixtures/evolution (critério 1.4).
6. Script pnpm jobs:replay --event <id>.
Não invente campos do payload: use só o que está nos fixtures tirados da documentação.
```

---

## 1.5 · Simulador de financiamento (página pública)
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Leia docs/DESIGN.md. Crie /simulador/[tenantSlug], página pública e responsiva:
- Pergunta em etapas (uma por tela, com animação de transição): renda familiar, vínculo,
  tempo de carteira, valor de entrada, nome e WhatsApp.
- Caixa de consentimento com texto versionado (versão em constante; o texto final é a Q12 de
  docs/DECISIONS.md, use um rascunho marcado como tal).
- Ao enviar: grava pelo serviço de ingestão com origem "simulator" e as respostas já
  preenchidas na triagem; mostra mensagem de "um corretor vai falar com você pelo WhatsApp".
- Não exibir valores de parcela ou promessa de aprovação.
- Proteção contra spam (rate limit + honeypot).
Teste e2e para o critério 1.7.
```

---

## 1.6 · Importação CSV e cadastro manual
**Modelo:** `sonnet` · **Esforço:** `medium`

```
1. Tela de importação CSV: upload, mapeamento de colunas, prévia com contagem de novos,
   duplicados (mesclados) e inválidos com motivo; confirmação; processamento em job.
   Registre a base legal escolhida pelo usuário na importação (obrigatório).
2. Formulário de cadastro manual de lead (nome, telefone, origem, observação).
Teste do critério 1.8.
```

---

## 1.7 · Dados de demonstração
**Modelo:** `haiku` · **Esforço:** `low`

```
Amplie supabase/seed.sql com 40 leads fictícios para a "Imobiliária Demo": nomes brasileiros
variados, telefones com DDD 16 claramente falsos (99999-xxxx), origens variadas (anúncio,
simulador, indicação, CSV) e datas nos últimos 30 dias. Não use dados de pessoas reais.
```

---

## 1.8 · Revisão da fase
**Modelo:** `opus` · **Esforço:** `high`

```
/revisar-fase 1
```
