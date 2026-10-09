# Fase 3: Distribuição e SLA

Antes de começar, responda Q6, Q7 e Q8 de `docs/DECISIONS.md`.

---

## 3.1 · Plano da fase
**Modelo:** `opus` · **Esforço:** `medium` · **Modo:** plano

```
Leia CLAUDE.md, docs/ARCHITECTURE.md (seção 6.4), docs/VALIDATION.md (fase 3) e as respostas
Q6 a Q8. Proponha as tabelas (distribution_rules, sla_policies, assignments), os jobs
(distribution.assign, sla.check) e o que conta como "primeiro contato" do corretor.
Considere horário comercial no SLA (lead que chega às 23h). Espere aprovação.
```

---

## 3.2 · Distribuição
**Modelo:** `sonnet` · **Esforço:** `medium`

```
1. Migration: distribution_rules, assignments (+ campo "ativo para receber leads" no
   membership) com RLS e testes.
2. packages/core: estratégias round_robin (justo mesmo com corretores entrando e saindo,
   estado guardado no banco) e manual (fila "Distribuir").
3. Job "distribution.assign": aplica a regra, grava assignment e lead_event, avisa o corretor
   pelo WhatsApp dele (mensagem curta com nome do lead e link para a ficha).
4. Atribuição manual pelo gerente na interface (server action com checagem de papel).
Testes para 3.1 e 3.2. Evite condição de corrida: dois leads ao mesmo tempo não podem ir para
o mesmo corretor fora da vez (use lock de linha ou advisory lock).
```

---

## 3.3 · SLA e redistribuição
**Modelo:** `sonnet` · **Esforço:** `medium`

```
1. Migration sla_policies com padrão por tenant.
2. Ao atribuir, agendar "sla.check" com pg-boss (startAfter) respeitando horário comercial.
3. "sla.check": se não houve primeiro contato, alerta corretor e gerente; se auto_reassign,
   redistribui e registra. Idempotente (singletonKey por lead + atribuição).
4. "Assumir conversa": muda conversation.mode para human, conta como primeiro contato,
   a IA para de responder. Mensagens do corretor enviadas pelo sistema passam pelo gateway.
Testes com relógio simulado para 3.3, 3.4 e 3.5.
```

---

## 3.4 · Revisão da fase
**Modelo:** `opus` · **Esforço:** `high`

```
/revisar-fase 3
```
