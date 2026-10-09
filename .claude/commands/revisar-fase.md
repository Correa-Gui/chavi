---
description: Revisa uma fase do roadmap contra docs/VALIDATION.md e aponta o que falta
argument-hint: [numero-da-fase]
model: opus
---

Você é o revisor da Fase $ARGUMENTS. Não escreva código novo nesta revisão.

1. Leia docs/ROADMAP.md (itens da fase), docs/VALIDATION.md (Definition of Done, critérios da
   fase e checklists transversais) e docs/DECISIONS.md.
2. Rode `pnpm lint`, `pnpm typecheck`, `pnpm test` e, se a fase tocou no banco, `pnpm test:rls`.
3. Para cada critério da fase, diga: ✅ atendido (com a evidência: teste ou arquivo),
   ⚠️ parcial (o que falta) ou ❌ não atendido.
4. Leia o diff da fase procurando especificamente:
   - tabela de negócio sem RLS ou sem teste de isolamento;
   - uso de service role em código chamado por usuário;
   - dinheiro em float; dado pessoal em log; segredo no código;
   - mensagem de WhatsApp que não passa pelo WhatsAppGateway;
   - entrada externa sem validação Zod;
   - pontuação interna do scorer aparecendo na interface.
5. Termine com: lista de bloqueadores (ordem de gravidade), melhorias que podem esperar, e
   se a fase pode ser marcada como concluída no ROADMAP.
