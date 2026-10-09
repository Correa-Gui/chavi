# Fase 4: Telas do CRM

Referência visual obrigatória: `docs/DESIGN.md` e o canvas de mockups linkado nele.
Antes de começar, responda Q1, Q9 e Q10 de `docs/DECISIONS.md`.

---

## 4.1 · Plano das telas
**Modelo:** `opus` · **Esforço:** `medium` · **Modo:** plano

```
Leia docs/DESIGN.md e docs/VALIDATION.md (fase 4). Para cada tela (Painel de leads, Funil,
Ficha do lead) liste: dados necessários e de onde vêm, queries (com índices necessários),
componentes, estados (vazio, carregando, erro) e comportamento no celular.
Defina como a tela atualiza em tempo real (Supabase Realtime ou revalidação) quando a IA
classifica um lead. Espere aprovação.
```

---

## 4.2 · Painel de leads
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Implemente /leads seguindo o mockup "1 · Painel de leads" e docs/DESIGN.md:
- Saudação com nome do usuário e frase de contexto ("3 estão esperando você").
- 4 KpiCards: Quentes hoje (card escuro), Leads hoje (barra por origem), 1ª resposta da IA
  (média), Esperando corretor (fundo de alerta, com quantos passaram do SLA).
- Fila com filtros por status (Todos, Quentes, Mornos, Em triagem, Frios), busca por nome ou
  telefone, paginação. Coluna "Status" só com a palavra; "IA digitando" quando ativa.
- Linhas entram em cascata; números contam até o valor; respeitar movimento reduzido.
- Atualização em tempo real conforme o plano.
Corretor vê só os próprios leads (RLS, não só filtro de tela).
```

---

## 4.3 · Funil kanban
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Implemente /funil seguindo o mockup "2 · Funil" e docs/DESIGN.md:
- Colunas: Novo, Triagem IA, Qualificado, Visita, Análise de crédito, Fechado (+ Perdido
  recolhido). Barra colorida no topo de cada coluna; Fechado escura.
- Cards com avatar, nome, imóvel, etiqueta de status e próximo passo; "IA conversando" nos
  que estão em triagem.
- Arrastar e soltar entre colunas (dnd-kit), com atualização otimista e desfazer em caso de
  erro; teclado também move cards (acessibilidade).
- Mover para Perdido abre modal com motivo obrigatório (lista da Q10).
- Alternância "Equipe toda" / "Meus leads" conforme o papel.
Testes e2e para 4.2.
```

---

## 4.4 · Ficha do lead
**Modelo:** `sonnet` · **Esforço:** `high`

```
Implemente /leads/[id] seguindo o mockup "3 · Ficha do lead" e docs/DESIGN.md:
- Cabeçalho: nome, telefone, origem, tempo; botões "Agendar visita" e "Assumir conversa".
- Card escuro "Temperatura do lead" com a palavra do status e a régua Frio → Morno → Quente.
- Conversa do WhatsApp em tempo real; mensagens novas entram com animação; depois de assumir,
  o corretor responde pela caixa de texto (via gateway, respeitando a janela).
- "Prazo do 1º contato" com contagem regressiva real do SLA.
- "Por que é quente?" com os motivos do scorer (sem pontos).
- Imóvel de interesse (texto por enquanto; vínculo real na fase 5).
- Card de registro: consentimento, versão da classificação, distribuição.
- Agendar visita e tarefas simples (tasks).
- Cada abertura da ficha grava personal_data_access_log.
Teste e2e para 4.3.
```

---

## 4.5 · LGPD: exportar e excluir titular
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Na ficha do lead (só admin): "Exportar dados" gera JSON com lead, eventos, mensagens,
respostas da triagem e decisões da IA; "Excluir dados" anonimiza (nome, telefone, e-mail,
mensagens) mantendo métricas agregadas, registra no audit_log e bloqueia novos contatos.
Teste para 4.6.
```

---

## 4.6 · Polimento
**Modelo:** `haiku` · **Esforço:** `low`

```
Revise todas as telas e ajuste: estados vazios com texto útil ("Nenhum lead quente agora.
A IA avisa quando chegar um."), skeletons de carregamento no formato dos cards, mensagens de
erro em português claro, títulos das páginas e textos de botões consistentes. Não mude
layout nem cores.
```

---

## 4.7 · Responsivo e acessibilidade
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Rode as três telas em 390 px, 768 px e 1440 px (Playwright) e corrija quebras: menu vira
barra superior, kanban rola horizontalmente dentro da área, fila vira lista de cards no
celular. Rode axe em cada tela e corrija contraste, rótulos e foco. Critérios 4.4 e 4.5.
```

---

## 4.8 · Revisão final do MVP
**Modelo:** `opus` · **Esforço:** `xhigh`

```
/revisar-fase 4
Depois faça uma revisão de prontidão para produção do MVP inteiro: segurança (RLS, rotas,
segredos), LGPD (checklist de docs/VALIDATION.md), confiabilidade (o que acontece se
Evolution, Anthropic API ou o worker caírem), custos estimados por lead e um roteiro de
implantação (variáveis de ambiente, migrations, webhook da Evolution, primeiro usuário).
Liste bloqueadores e o que pode ficar para depois.
```
