---
paths:
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/config/**"
---

# Regras de interface

- Leia `docs/DESIGN.md` antes de criar ou alterar tela. Use só os tokens do preset; não
  invente cores, fontes ou raios.
- Status do lead em palavras (Quente, Morno, Frio, Em triagem, Fora do perfil); nunca número.
- Animações com Motion seguindo a tabela de movimento; sempre respeitar
  `prefers-reduced-motion`.
- Botões são `<button>`, links são `<a>`; ícone sozinho tem `aria-label`; foco visível.
- Todas as telas funcionam a partir de 390 px de largura.
- Componentes não fazem query direto: dados vêm de server components ou server actions que
  usam `packages/db`.
- Textos em português do Brasil.
