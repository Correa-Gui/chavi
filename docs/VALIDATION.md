# Validação

Uma tarefa só está pronta quando passa no **Definition of Done** e nos **critérios da fase**.
Uma fase só está pronta quando o prompt de revisão (`/revisar-fase N`, modelo Opus) aprova.

## Definition of Done (toda tarefa)
- [ ] `pnpm lint`, `pnpm typecheck` e `pnpm test` passam
- [ ] Toda tabela nova de negócio tem RLS e teste em `pnpm test:rls`
- [ ] Toda entrada externa validada com Zod
- [ ] Nenhum dado pessoal em log (telefone, e-mail, renda mascarados)
- [ ] Nenhum segredo no código ou em commit
- [ ] Textos de interface em português do Brasil, sem erro de digitação
- [ ] Item marcado em `docs/ROADMAP.md`; decisão nova registrada em `docs/DECISIONS.md`

---

## Fase 0: Fundação
| # | Critério | Como verificar |
|---|---|---|
| 0.1 | `pnpm install && pnpm dev` sobe web e worker sem erro | manual |
| 0.2 | `supabase db reset` cria o banco com seed de 2 tenants e usuários de cada papel | manual |
| 0.3 | Usuário do tenant A não lê nem escreve nada do tenant B em nenhuma tabela | `pnpm test:rls` |
| 0.4 | Usuário sem membership não lê nada | `pnpm test:rls` |
| 0.5 | Corretor não altera papel de ninguém; admin consegue | `pnpm test:rls` |
| 0.6 | CI roda lint, typecheck, unidade e RLS em cada PR | ver pipeline |
| 0.7 | Shell visual segue `DESIGN.md` (menu grafite, painel areia, fontes) | comparar com o mockup |
| 0.8 | Job de exemplo no pg-boss roda, falha uma vez e tem retry | teste de integração |

## Fase 1: Captura e tratamento
| # | Critério | Como verificar |
|---|---|---|
| 1.1 | `(16) 99812-4410`, `16998124410`, `+55 16 99812-4410` viram `+5516998124410` | unidade |
| 1.2 | Número inválido é rejeitado com motivo, sem quebrar o lote | unidade |
| 1.3 | Mesmo telefone em duas origens gera **1** lead e 2 eventos de origem | integração |
| 1.4 | Mesmo webhook recebido 3 vezes gera 1 mensagem e 1 lead | integração |
| 1.5 | Webhook sem segredo válido → 401, nada gravado | integração |
| 1.6 | Falha no processamento deixa `webhook_events.status=failed` e o retry funciona | integração |
| 1.7 | Simulador grava consentimento com versão do texto e horário | e2e |
| 1.8 | CSV de 500 linhas com 50 duplicados: prévia mostra 450 novos e 50 mesclados | integração |
| 1.9 | Lead de um tenant nunca aparece em outro, mesmo com o mesmo telefone | `pnpm test:rls` |

## Fase 2: Triagem por IA
| # | Critério | Como verificar |
|---|---|---|
| 2.1 | IA se apresenta como assistente virtual da imobiliária na 1ª mensagem | eval |
| 2.2 | IA pede consentimento antes de perguntar renda | eval |
| 2.3 | Extração acerta renda, vínculo, FGTS, entrada e prazo em ≥ 90% do conjunto de avaliação | `pnpm eval:triage` |
| 2.4 | Classificação bate com a do gestor em ≥ 85% dos casos rotulados | `pnpm eval:triage` |
| 2.5 | "Quero falar com uma pessoa" → IA para em até 1 mensagem e o lead vai para distribuição | eval + integração |
| 2.6 | "Sair"/"parar" → opt-out registrado, nenhuma mensagem nova enviada | integração |
| 2.7 | Fora da janela de atendimento, envio de texto livre é bloqueado pelo gateway | unidade |
| 2.8 | Toda chamada ao LLM gera linha em `ai_decisions` com modelo e versão do prompt | integração |
| 2.9 | LLM fora do ar: lead fica "Em triagem", job tenta de novo, nada se perde | integração |
| 2.10 | IA nunca promete aprovação de crédito, valor de parcela ou taxa | eval (casos adversariais) |
| 2.11 | Pontuação interna não aparece na interface | revisão |

## Fase 3: Distribuição e SLA
| # | Critério | Como verificar |
|---|---|---|
| 3.1 | Rodízio entre 3 corretores ativos distribui 9 leads 3/3/3 | unidade |
| 3.2 | Corretor inativo não recebe lead | unidade |
| 3.3 | Sem contato em X minutos → alerta ao corretor e ao gerente | integração (relógio simulado) |
| 3.4 | Com redistribuição ligada, lead vai para o próximo e fica em `assignments` | integração |
| 3.5 | "Assumir conversa" muda para `mode=human` e a IA não responde mais | integração |

## Fase 4: Telas do CRM
| # | Critério | Como verificar |
|---|---|---|
| 4.1 | Corretor vê só os próprios leads; gerente vê a equipe | e2e |
| 4.2 | Mover para "Perdido" exige motivo | e2e |
| 4.3 | Ficha mostra conversa, motivos da classificação, SLA e imóvel | e2e |
| 4.4 | Telas funcionam em 390 px de largura sem rolagem horizontal da página | e2e (viewport mobile) |
| 4.5 | Contraste de texto ≥ 4.5:1; navegação por teclado; `prefers-reduced-motion` respeitado | axe + manual |
| 4.6 | Exportar dados do titular gera JSON com tudo do lead; excluir anonimiza e registra | integração |
| 4.7 | Painel carrega em < 1 s com 5 mil leads no tenant | teste de carga simples |

## Fases 5 a 7
Critérios detalhados serão escritos no início de cada fase, a partir das decisões de negócio.
Para comissões, desde já obrigatório:
- Soma dos lançamentos = valor total da comissão, ao centavo, para qualquer divisão
- Arredondamento pelo método do maior resto, determinístico
- Estorno gera lançamentos negativos; nunca apaga histórico
- Toda alteração em regra ou lançamento vai para `audit_log` com antes e depois

---

## Checklists transversais

### LGPD
- [ ] Texto de consentimento versionado; versão gravada no lead
- [ ] Base legal registrada por lead
- [ ] A triagem só pergunta o necessário (sem CPF, sem documentos)
- [ ] Acesso à ficha do lead gravado em `personal_data_access_log`
- [ ] Exportação e exclusão do titular funcionando
- [ ] Opt-out respeitado em todos os canais

### Segurança
- [ ] Nenhuma rota de usuário usa service role
- [ ] Webhooks autenticados e idempotentes
- [ ] Rate limit no simulador público e nos webhooks
- [ ] Dependências sem vulnerabilidade crítica (`pnpm audit`)

### WhatsApp
- [ ] Toda saída passa pelo `WhatsAppGateway`
- [ ] Janela de atendimento verificada antes de texto livre
- [ ] Nenhum disparo para lista que não deu opt-in
