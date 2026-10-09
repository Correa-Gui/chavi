# Design: direção "Brasa"

Mockups aprovados (canvas com 3 telas: Painel de leads, Funil, Ficha do lead):
https://claude.ai/artifact/JqQ6JivPpmsCzK1LTuSLXq

A ideia: o lead tem uma **temperatura**. A interface é neutra e quente (grafite + areia), e a cor
forte aparece para o que é quente ou pede ação.

## Princípios
1. **Status em palavras, não em números.** Quente, Morno, Frio, Em triagem, Fora do perfil.
   Nunca mostrar graus ou pontuação.
2. **Uma etiqueta de status por item.** Não repetir a mesma informação em cor, barra e texto.
3. **Revelação progressiva.** A lista mostra o necessário para agir; detalhes ficam na ficha.
4. **Cor reforça, não carrega sozinha a informação.** Toda etiqueta colorida tem texto.
5. **Animação com propósito:** entrada suave, IA "digitando", pulso só no que pede ação.

## Tokens (Tailwind preset em `packages/config`)

### Cores
| Token | Valor | Uso |
|---|---|---|
| `shell` | `#0D0F14` | Fundo da moldura e do menu lateral |
| `shell-raised` | `#1A1D25` | Item ativo do menu, cards no escuro |
| `panel` | `#F4F1EC` | Painel principal (areia) |
| `surface` | `#FFFFFF` | Cards |
| `column` | `#EAE4DB` | Colunas do kanban |
| `line` | `#F0ECE6` | Divisórias |
| `ink` | `#14161C` | Texto principal, botão primário |
| `ink-2` | `#57514A` | Texto secundário |
| `ink-3` | `#6B6458` | Legendas |
| `nav-text` | `#A1A1AA` | Texto do menu escuro |
| `accent` | `#FF6B2C` | Marca, quente, badges de contagem (texto sobre ele: `ink`) |

### Status
| Status | Fundo | Texto | Avatar |
|---|---|---|---|
| Quente | `#FFE4D6` | `#9A3412` | `#FFD3BD` |
| Morno | `#FEF3C7` | `#78350F` | `#FDE68A` |
| Frio | `#DBEAFE` | `#1E3A8A` | `#BFDBFE` |
| Em triagem (IA) | `#E9E8FF` + brilho animado | `#3730A3` | `#DDDCFF` |
| Fora do perfil | `#F0ECE6` | `#57514A` | `#E7E2DA` |
| Alerta de SLA | `#FFE4D6` | `#7C2D12` | |
| Fechado/sucesso | `#1F232D` | `#86EFAC` | |

### Tipografia (Google Fonts)
- Títulos e números grandes: **Bricolage Grotesque** 700/800, `letter-spacing: -0.035em`
- Interface: **Geist** 400/500/600/700
- Telefones, horários e contadores: **Geist Mono** 400/500
- Escala: 12 / 13 / 14 / 15 / 19 / 20 / 30 / 40 / 48 px

### Forma e espaço
- Raios: 10 (botão pequeno), 12 (botão/input), 16 (card do kanban), 20–22 (cards), 24 (painel)
- Painel principal com 10 px de margem da moldura escura
- Espaçamento base 4 px; gaps comuns 8 / 10 / 14 / 24
- Alvos de toque ≥ 44 px

## Componentes
- **Menu lateral escuro:** logo, itens com ícone (lucide, traço 2 px), item ativo `shell-raised`,
  contador laranja em "Leads", card "IA atendendo agora" no rodapé com ponto pulsante.
- **Card de número (KPI):** número grande em Bricolage com contagem animada de 0 ao valor.
  O card "Quentes hoje" é escuro com brilho laranja desfocado; "Esperando corretor" usa o
  fundo de alerta.
- **Etiqueta de status:** pílula com o texto do status. "Em triagem" tem brilho animado.
- **Fila de leads:** linha em grid; avatar com iniciais na cor do status; nome + telefone;
  status; perfil de crédito resumido; origem; conversa ("IA digitando ●●●" quando ativa);
  corretor; tempo.
- **Kanban:** colunas `column` com barra fina colorida no topo por etapa; card branco com
  avatar, nome, imóvel, etiqueta de status e próximo passo. Coluna "Fechado" escura.
- **Ficha do lead:** cabeçalho (nome, telefone, origem, ações), card escuro "Temperatura do
  lead" com a palavra do status e a régua Frio → Morno → Quente, conversa do WhatsApp,
  "Prazo do 1º contato" com contagem regressiva, "Por que é quente?" com ✓ por motivo,
  imóvel de interesse, card escuro de registro (LGPD, classificação, distribuição).

## Movimento (Motion)
| Animação | Especificação |
|---|---|
| Entrada de cards/linhas | opacidade 0→1 e `y` 12→0, 0,6 s, `cubic-bezier(.2,.7,.2,1)`, atraso em cascata de 60–70 ms |
| Contagem de KPI | 0 → valor em ~1,1 s, easing cúbico de saída |
| Barras | `scaleX` 0→1 a partir da esquerda, 1,1 s |
| Pulso | anel que expande e some, 1,8 s, infinito; só em itens que pedem ação |
| IA digitando | 3 pontos com opacidade alternada, 1,2 s, atraso 0,15 s entre eles |
| Nova mensagem na conversa | escala 0,92→1 + `y` 6→0, 0,4 s |
| Hover em card | `translateY(-3px)` + sombra suave, 0,2 s |
| Movimento reduzido | com `prefers-reduced-motion: reduce`, desligar todas as animações |

## Acessibilidade
- Contraste mínimo 4.5:1 para texto (3:1 acima de 24 px)
- Botões são `<button>`, links são `<a>`; ícone sozinho tem `aria-label`
- Foco visível em todos os elementos interativos
- Status nunca diferenciado só por cor (sempre há texto)
