# Roadmap

**MVP = fases 0 a 4.** Ao final da fase 4, a imobiliária do fundador usa o sistema em produção
com leads reais. As fases 5 a 7 só começam depois de 2 a 4 semanas de uso real.

Esforço relativo: P (pequeno) · M (médio) · G (grande). Prompts de cada fase em `prompts/`.

---

## Fase 0: Fundação · G
Objetivo: repositório rodando, login funcionando, isolamento entre imobiliárias provado por teste.
- [x] Monorepo (pnpm + Turborepo), lint, typecheck, Vitest, CI
- [x] Supabase local, migrations, seed com tenant de demonstração (dev em nuvem: chavi-dev; local só no CI, ADR-010)
- [x] Tabelas `tenants`, `memberships`, `profiles` + RLS + função `auth_tenant_ids()`
- [ ] Login (e-mail mágico ou senha), convite de usuário para a imobiliária, papéis
- [x] Testes de RLS (`pnpm test:rls`) rodando no CI
- [ ] Tokens do `DESIGN.md` no Tailwind + shell da aplicação (menu escuro, painel areia)
- [ ] Worker com pg-boss rodando um job de exemplo

## Fase 1: Captura e tratamento · M
Objetivo: lead entra por qualquer origem do MVP, sem duplicar, com origem e consentimento.
- [ ] `packages/core`: normalização de telefone (E.164 BR) e e-mail, deduplicação, mesclagem
- [ ] Tabelas `leads`, `lead_sources`, `lead_events`, `webhook_events` + RLS + testes
- [ ] `WhatsAppGateway` + `EvolutionAdapter` (receber mensagens; enviar texto)
- [ ] Webhook Evolution idempotente → fila → criação de lead
- [ ] Captura da origem do anúncio Click to WhatsApp (se o payload trouxer)
- [ ] Simulador público por imobiliária (captura + consentimento LGPD)
- [ ] Importação CSV com pré-visualização e relatório de duplicados
- [ ] Cadastro manual de lead

## Fase 2: Triagem por IA · G
Objetivo: a IA conversa, coleta os dados de financiamento e classifica sem humano.
- [ ] Tabelas `conversations`, `messages`, `triage_sessions`, `ai_decisions` + RLS
- [ ] `TriageEngine` (máquina de estados) + prompts versionados em `packages/integrations/llm`
- [ ] Extração estruturada das respostas (renda, vínculo, FGTS, entrada, prazo, interesse)
- [ ] `LeadScorer` interface + `RulesScorerV1` com limites por tenant
- [ ] Pedido de humano, opt-out, inatividade e limite de mensagens
- [ ] Janela de atendimento respeitada; fora dela, só template
- [ ] Conjunto de avaliação com conversas de exemplo e relatório de acerto

## Fase 3: Distribuição e SLA · M
Objetivo: lead quente chega ao corretor certo e ninguém fica sem resposta.
- [ ] `distribution_rules` (rodízio e manual), `assignments`
- [ ] `sla_policies` + job `sla.check` + alerta ao corretor e ao gerente
- [ ] Redistribuição automática opcional
- [ ] "Assumir conversa": IA para, corretor responde pelo sistema

## Fase 4: Telas do CRM · G
Objetivo: as três telas do mockup funcionando com dados reais.
- [ ] Painel de leads (números do dia, filtros por status, fila)
- [ ] Funil kanban (arrastar, motivo de perda obrigatório, visão equipe/meus leads)
- [ ] Ficha do lead (conversa, "Por que é quente?", SLA, agendar visita, tarefas)
- [ ] Responsivo (corretor usa no celular), estados vazios e de carregamento
- [ ] Exportação e exclusão de dados do titular (LGPD)
- [ ] **Piloto em produção na imobiliária do fundador**

---

## Pós-MVP

## Fase 5: Imóveis · M
- [ ] Cadastro de imóveis/empreendimentos, fotos (Supabase Storage), status, proprietário
- [ ] Vínculo lead ↔ imóvel de interesse; IA usa a lista de imóveis na conversa
- [ ] Negócio (lead + imóvel + corretor + valor)

## Fase 6: Comissões · G
- [ ] Regras de comissão por imobiliária (percentual + divisão entre beneficiários)
- [ ] Lançamentos por beneficiário com ciclo prevista → a receber → liberada → paga, estorno
- [ ] Gatilho de liberação configurável
- [ ] Trilha de auditoria completa
- [ ] Testes de arredondamento e estorno

## Fase 7: Relatórios e extrato · M
- [ ] Conversão por origem e por corretor
- [ ] Extrato de comissões por corretor e fechamento mensal
- [ ] Custo por lead quente por campanha (se houver dado de investimento)
