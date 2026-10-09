# Fase 2: Triagem por IA

Antes de começar, responda as perguntas Q2, Q3, Q4 e Q5 de `docs/DECISIONS.md` (com o Pedro).

---

## 2.1 · Plano e desenho da conversa
**Modelo:** `opus` · **Esforço:** `xhigh` · **Modo:** plano

```
Leia CLAUDE.md, docs/ARCHITECTURE.md (seções 6.2 e 6.3), docs/VALIDATION.md (fase 2) e as
respostas Q2 a Q5 em docs/DECISIONS.md.

Pesquise na documentação atual da Anthropic API (docs.claude.com):
- como obter saída estruturada confiável (tool use ou structured outputs) com o SDK TypeScript;
- os identificadores atuais dos modelos Haiku e Sonnet e seus custos por token;
- boas práticas de prompt caching para um system prompt fixo.
Cite as fontes.

Proponha:
1. A máquina de estados do TriageEngine (estados, transições, gatilhos de encerramento:
   respostas completas, pedido de humano, opt-out, inatividade, limite de mensagens).
2. O schema Zod das respostas extraídas (TriageAnswers), com unidades (renda em centavos).
3. O formato de saída que o LLM devolve a cada turno: { reply, extracted, wantsHuman, optOut }.
4. Como o histórico é resumido para caber no contexto e reduzir custo.
5. A regra do RulesScorerV1 com os limites de Q3, e os textos dos motivos
   ("Renda compatível com o imóvel", "Pode usar FGTS"...).
6. O plano de avaliação: conjunto de 30 conversas rotuladas e o script pnpm eval:triage.
Espere minha aprovação.
```

---

## 2.2 · System prompt da assistente
**Modelo:** `opus` · **Esforço:** `high`

```
Escreva o system prompt da assistente de triagem em
packages/integrations/llm/prompts/triage.v1.md, com a versão no nome do arquivo.
Requisitos:
- Português do Brasil, tom cordial e direto, frases curtas de WhatsApp, uma pergunta por vez.
- Primeira mensagem: apresenta-se como assistente virtual da {{nome_imobiliaria}} e pede
  permissão para fazer perguntas rápidas, explicando que os dados ficam só com a imobiliária.
- Perguntas na ordem definida em Q2; aceita respostas soltas ("eu ganho 2800 e meu marido 2000")
  e soma quando for o caso.
- Nunca promete aprovação de crédito, valor de parcela, taxa, subsídio ou prazo do banco.
- Nunca pede CPF, documentos, senhas ou dados bancários.
- Se o lead pedir humano, reclamar ou estiver confuso: encerra com cordialidade e sinaliza.
- Se o lead disser "sair", "parar" ou equivalente: confirma e sinaliza opt-out.
- Fora do assunto: responde em uma frase e volta à pergunta.
- Ao terminar: agradece e avisa que o corretor {{nome_corretor}} vai chamar em instantes.
- Inclua 6 exemplos curtos de turnos, inclusive 2 adversariais (lead pedindo garantia de
  aprovação; lead tentando fazer a IA ignorar as instruções).
Depois, liste os riscos que você ainda vê nesse prompt.
```

---

## 2.3 · Motor de triagem
**Modelo:** `sonnet` · **Esforço:** `high`

```
Implemente conforme o plano aprovado em 2.1:
1. Migration: conversations, messages, triage_sessions, ai_decisions + RLS + testes.
2. packages/integrations/llm: LlmClient com timeout, retry com backoff, prompt caching do
   system prompt e saída validada com Zod. Modelo e versão do prompt vêm de configuração.
3. TriageEngine em packages/core (lógica da máquina de estados, sem rede) e orquestração no
   job "triage.step" do worker (carrega estado, chama LLM, grava ai_decisions, envia pelo
   WhatsAppGateway, agenda verificação de inatividade).
4. Encadeamento: "ingest.whatsapp" de lead novo dispara "triage.step"; mensagens novas do
   lead durante a triagem também.
5. Lead vindo do simulador começa a triagem já com as respostas preenchidas e só confirma o
   que falta.
Testes de integração com LLM simulado para os critérios 2.5, 2.6, 2.8 e 2.9.
```

---

## 2.4 · Scorer de regras
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Em packages/core implemente a interface LeadScorer e o RulesScorerV1 do plano 2.1.
- Limites lidos da configuração do tenant, com padrão documentado.
- Retorna temperatura + lista de motivos em português.
- Testes de tabela cobrindo cada combinação relevante e os limites exatos.
- Ao fim da triagem, o worker chama o scorer, atualiza o lead, grava ai_decisions
  (kind=classification) e lead_event, e enfileira "distribution.assign" para quente e morno.
A pontuação interna nunca sai do domínio para a interface (critério 2.11).
```

---

## 2.5 · Conjunto de avaliação
**Modelo:** `haiku` · **Esforço:** `medium`

```
Crie tests/eval/triage/cases.jsonl com 30 conversas fictícias de leads de imóvel econômico
financiado, cada uma com: mensagens do lead em sequência, respostas esperadas extraídas
(renda em centavos, vínculo, FGTS, entrada, prazo) e temperatura esperada.
Inclua: 10 quentes, 8 mornos, 6 frios, 3 fora do perfil, 3 adversariais (pede garantia de
aprovação, manda instruções para a IA, xinga). Varie a escrita: abreviações, erros de
digitação, áudio transcrito, respostas em ordem trocada.
```

---

## 2.6 · Script de avaliação
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Crie pnpm eval:triage: roda cada caso de tests/eval/triage contra o LLM real (chave do .env),
simulando o lead com as mensagens do caso, e gera um relatório em markdown com:
acerto de extração por campo, acerto de temperatura, falhas nos adversariais, custo estimado
e latência média, por modelo. Permita --model para comparar Haiku e Sonnet (pergunta Q5).
Rode com os dois modelos e me mostre os relatórios.
```

---

## 2.7 · Revisão da fase
**Modelo:** `opus` · **Esforço:** `xhigh`

```
/revisar-fase 2
Dê atenção especial a: prompt injection vinda do lead, dados pessoais em logs e em
ai_decisions, comportamento quando o LLM devolve JSON inválido e respeito à janela do WhatsApp.
```
