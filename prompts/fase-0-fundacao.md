# Fase 0: Fundação

Rode os prompts em ordem. Cada um indica o modelo (`/model <alias>`) e o esforço (`/effort <nível>`).
Comece uma sessão nova (`/clear`) entre prompts grandes para não carregar contexto velho.

---

## 0.1 · Plano da fundação
**Modelo:** `opus` · **Esforço:** `high` · **Modo:** plano (Shift+Tab até "plan mode")

```
Leia CLAUDE.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, docs/VALIDATION.md e docs/DECISIONS.md.

Quero começar a Fase 0 (Fundação). Antes de escrever código:
1. Liste até 6 dúvidas que impedem você de começar, em ordem de prioridade.
2. Confira na documentação atual as versões estáveis de Next.js, Supabase CLI, pg-boss,
   Turborepo, Tailwind, shadcn/ui e Motion, e se o pg-boss funciona com o Postgres do
   Supabase (qual string de conexão usar). Cite a fonte de cada informação.
3. Proponha a árvore de pastas final e a lista de scripts do package.json raiz.
4. Divida a fase em tarefas pequenas, cada uma com critério de aceite ligado a docs/VALIDATION.md.

Não crie arquivos ainda. Espere minha aprovação.
```

---

## 0.2 · Scaffold do monorepo
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Implemente o scaffold aprovado no plano da Fase 0:
- pnpm workspaces + Turborepo com apps/web (Next.js App Router, TypeScript estrito),
  apps/worker (Node + TypeScript) e packages core, db, integrations e config.
- ESLint, Prettier, Vitest configurados na raiz; scripts: dev, build, lint, typecheck, test.
- Validação das variáveis de ambiente com Zod em cada app; crie .env.example sem valores reais.
- GitHub Actions rodando lint, typecheck e test em cada PR.

Ao final, rode lint, typecheck e test e me mostre o resultado. Atualize a seção "Comandos" do
CLAUDE.md se algo mudou.
```

---

## 0.3 · Banco multi-tenant, autenticação e RLS
**Modelo:** `opus` · **Esforço:** `high`

```
Tarefa crítica de segurança. Implemente:
1. Supabase local (supabase init) e a primeira migration com: tenants, memberships (papéis
   admin, gerente, corretor, financeiro), profiles, audit_log.
2. Função SQL auth_tenant_ids() (security definer, search_path fixo) e políticas RLS em
   todas as tabelas, seguindo docs/ARCHITECTURE.md seção 4.
3. seed.sql com 2 tenants ("Imobiliária Demo" e "Imobiliária Teste") e um usuário de cada
   papel em cada tenant.
4. Login com Supabase Auth no apps/web (e-mail + link mágico) e seleção de imobiliária quando
   o usuário pertence a mais de uma.
5. Convite de usuário pelo admin, com papel.
6. pnpm test:rls: testes que logam como cada usuário do seed e provam os critérios 0.3 a 0.5
   de docs/VALIDATION.md, tentando ler, inserir, atualizar e apagar dados do outro tenant.
7. pnpm db:types gerando os tipos em packages/db.

Antes de terminar, revise você mesmo cada política: existe algum caminho em que um usuário
lê ou altera dado de outro tenant, ou altera o próprio papel? Mostre a revisão.
```

---

## 0.4 · Tokens visuais e shell da aplicação
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Leia docs/DESIGN.md por completo.
1. Crie o preset do Tailwind em packages/config com todos os tokens (cores, status, fontes,
   raios) e use-o no apps/web. Carregue Bricolage Grotesque, Geist e Geist Mono com next/font.
2. Instale shadcn/ui e ajuste o tema para os tokens (não use as cores padrão).
3. Crie o layout autenticado: moldura grafite, menu lateral (Leads, Funil, Imóveis, Comissões
   "em breve", Relatórios) e painel areia arredondado com margem de 10 px. No celular, o menu
   vira uma barra superior com menu recolhível.
4. Crie os componentes base: StatusBadge (5 status, "Em triagem" com brilho animado),
   KpiCard (com contagem animada), Avatar com iniciais por status, PulseDot, TypingDots.
   Use Motion para as animações descritas em DESIGN.md e respeite prefers-reduced-motion.
5. Página /dev/ui (só em desenvolvimento) mostrando todos os componentes.

Não invente cores fora dos tokens. Me mande a lista de componentes criados.
```

---

## 0.5 · Worker e fila
**Modelo:** `sonnet` · **Esforço:** `medium`

```
Configure o apps/worker com pg-boss conectado ao Postgres do Supabase local:
- Inicialização, shutdown gracioso, logs pino em JSON com jobId.
- Um job de exemplo "system.ping" com retry (3 tentativas, backoff exponencial).
- Helper em packages/db para enfileirar jobs a partir do apps/web com tenantId obrigatório.
- Teste de integração provando o critério 0.8 de docs/VALIDATION.md.
```

---

## 0.6 · Revisão da fase
**Modelo:** `opus` · **Esforço:** `high`

```
/revisar-fase 0
```
