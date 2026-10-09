# Chavi: CRM com triagem de leads por IA para imobiliárias

> "Chavi" é nome provisório. Público: imobiliárias pequenas e médias que vendem imóveis
> econômicos e financiados (MCMV / Caixa). Primeiro cliente: a imobiliária do fundador.

## O que estamos construindo (MVP)
Fluxo: **lead entra → IA conversa no WhatsApp e faz a triagem → classifica (quente / morno /
frio / fora do perfil) → distribui ao corretor → corretor acompanha no funil.**
Imóveis, comissões e relatórios vêm depois do MVP (ver `docs/ROADMAP.md`).

## Documentos de referência (leia antes de mexer na área correspondente)
- Arquitetura, stack e modelo de dados: @docs/ARCHITECTURE.md
- Roadmap e fase atual: @docs/ROADMAP.md
- Critérios de aceite e Definition of Done: @docs/VALIDATION.md
- `docs/DESIGN.md`: tokens visuais, componentes e animações (ler antes de qualquer UI)
- `docs/DECISIONS.md`: decisões tomadas (ADRs) e perguntas em aberto

## Comandos
```bash
pnpm install
pnpm dev                 # web + worker
pnpm test                # vitest (unidade + integração)
pnpm test:rls            # testes de isolamento entre tenants (exige supabase local)
pnpm test:e2e            # playwright
pnpm lint && pnpm typecheck
supabase start           # banco local
supabase db reset        # recria o banco a partir das migrations + seed
pnpm db:types            # regenera tipos TypeScript do banco
```
Se algum comando acima ainda não existir, crie-o na fase 0 e mantenha esta lista atualizada.

## Regras inegociáveis
1. **Multi-tenant sempre.** Toda tabela de negócio tem `tenant_id` e política RLS.
   Nunca use a service role key em código que roda a pedido do usuário. Toda migration nova
   com tabela de negócio vem acompanhada de teste em `pnpm test:rls`.
2. **Dinheiro em centavos inteiros** (`bigint` no banco, `number` inteiro ou `bigint` no TS).
   Percentuais em basis points (1% = 100). Nunca `float` para dinheiro.
3. **WhatsApp:** só envie mensagem livre dentro da janela de atendimento aberta pelo lead.
   Fora dela, apenas template aprovado. Respeite opt-out ("sair", "parar") imediatamente.
   Toda chamada ao WhatsApp passa pela interface `WhatsAppGateway`, nunca direto no Evolution.
4. **IA decide pouco e registra tudo.** O LLM conversa e extrai dados; quem classifica é o
   `LeadScorer` (regras). Cada decisão vai para `ai_decisions` com modelo, versão do prompt,
   entrada resumida e saída.
5. **LGPD:** consentimento e base legal registrados por lead; não pedir dado que a triagem não
   usa; acesso a dado pessoal fica em log; exportação e exclusão do titular devem funcionar.
6. **Webhooks idempotentes:** todo evento externo é gravado em `webhook_events` com chave única
   do provedor antes de ser processado. Processamento acontece no worker, com retry.
7. **Segredos** só em variáveis de ambiente. Nunca leia nem escreva `.env` com valores reais
   em commits, logs ou respostas.
8. **UI não mostra temperatura em número.** O lead é Quente, Morno, Frio, Em triagem ou Fora do
   perfil. Pontuação interna do scorer não aparece para o usuário.

## Como trabalhar neste repositório
- Trabalhe **uma tarefa do prompt da fase por vez**. Ao terminar, rode lint, typecheck e testes.
- Antes de implementar algo grande, apresente o plano e espere aprovação.
- Quando algo depender de regra de negócio (comissão, gatilhos, papéis, SLA), **pergunte**.
  Registre a resposta em `docs/DECISIONS.md`.
- Integrações externas (Evolution API, Meta, Anthropic API): **consulte a documentação atual**
  antes de escrever o adaptador. Não invente formato de payload.
- Ao concluir um item do roadmap, marque `[x]` em `docs/ROADMAP.md`.
- Commits pequenos, mensagem em português, no imperativo: `adiciona deduplicação por telefone`.
- Código e nomes técnicos em inglês; textos da interface e mensagens ao lead em português do Brasil.

## Convenções de código
- TypeScript estrito (`strict: true`), sem `any` sem justificativa em comentário.
- Validação de toda entrada externa com Zod (rotas, webhooks, formulários, variáveis de ambiente).
- Lógica de domínio pura em `packages/core` (sem acesso a banco ou rede), testada com Vitest.
- Acesso a banco só por `packages/db`. Componentes de UI não fazem query direto.
- Erros esperados retornam resultado tipado; exceções só para o inesperado.
- Logs estruturados com `pino`, sempre com `tenantId` e `requestId`/`jobId`; nunca logar
  telefone, e-mail ou renda completos (mascarar).
