# Kit de desenvolvimento do Chavi com Claude Code

## O que tem aqui
```
CLAUDE.md                      Instruções que o Claude Code lê em toda sessão
docs/ARCHITECTURE.md           Stack, pastas, modelo de dados, fluxos e interfaces
docs/ROADMAP.md                Fases com checklist (MVP = fases 0 a 4)
docs/VALIDATION.md             Definition of Done, critérios de aceite por fase, checklists
docs/DESIGN.md                 Direção visual "Brasa": tokens, componentes, animações
docs/DECISIONS.md              Decisões tomadas e perguntas em aberto (responda antes de cada fase)
prompts/fase-*.md              Prompts de cada fase, em ordem, com modelo e esforço indicados
.claude/commands/              /revisar-fase N (Opus) e /status (Haiku)
.claude/rules/                 Regras que carregam só ao mexer em banco, interface ou integrações
.claude/settings.json          Impede o Claude Code de ler seus arquivos .env
```

## Como começar
1. Crie um repositório vazio e copie todo o conteúdo deste kit para a raiz dele.
2. Abra o terminal na pasta e rode `claude`.
3. Rode `/status` para ver o primeiro passo.
4. Abra `prompts/fase-0-fundacao.md`, troque para o modelo indicado e cole o prompt 0.1.
5. Siga os prompts em ordem. Ao fim de cada fase rode `/revisar-fase N`.

## Qual modelo usar e por quê
| Alias | Quando usamos | Exemplos |
|---|---|---|
| `opus` | Planejar, decidir arquitetura, segurança, regras de dinheiro, revisar | planos de fase, RLS, prompt da IA, cálculo de comissão, revisões |
| `sonnet` | Implementar a maior parte do código | telas, rotas, jobs, adaptadores, testes |
| `haiku` | Tarefas simples e repetitivas | dados de demonstração, textos de estados vazios, `/status` |
| `opusplan` | Atalho opcional: Opus no modo de plano, Sonnet na execução | use se preferir não trocar de modelo à mão |

Comandos úteis no Claude Code:
- `/model opus`, `/model sonnet`, `/model haiku`: troca o modelo
- `/effort high` (ou `low`, `medium`, `xhigh`): quanto o modelo pensa antes de responder
- Shift+Tab: alterna os modos; use o **modo de plano** nos prompts marcados com "Modo: plano"
- `/clear`: limpa o contexto entre tarefas grandes

## Antes de cada fase
Responda as perguntas em aberto de `docs/DECISIONS.md` marcadas para aquela fase. As mais
importantes para o MVP são a Q2 e a Q3 (o que a IA pergunta e o que é um lead quente).
Vale fazer isso junto com o Pedro, que atende os leads hoje.

## O que você precisa ter em mãos
- Conta no Supabase (e Docker instalado, para o banco local)
- Instância da Evolution API v2, de preferência com a integração `WHATSAPP-BUSINESS`
- Chave da Anthropic API (para a IA de triagem)
- Conta no GitHub (CI) e um lugar para hospedar o worker (Railway, Fly ou Render)
