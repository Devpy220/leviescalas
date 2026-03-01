

## Ajuste do Dark Mode - Menos Roxo, Mais Contraste

### Problema
O modo escuro atual tem saturacao roxa demais em todas as superficies (background, cards, popover, muted, input, border, sidebar). Isso cria uma aparencia monocromatica e cansativa.

### Solucao
Reduzir drasticamente a saturacao roxa das superficies de fundo, mantendo o roxo apenas nos elementos interativos (primary, ring, gradients). O fundo e cards passam a ser quase preto com um toque sutil de roxo, criando contraste natural.

### Mudancas em `src/index.css` (bloco `.dark`)

**Superficies - de roxo saturado para quase-preto neutro:**

| Variavel | Antes | Depois | Visual |
|---|---|---|---|
| `--background` | `260 53% 8%` | `250 20% 5%` | Preto com toque sutil de roxo |
| `--card` | `261 52% 13%` | `252 15% 10%` | Cinza muito escuro, menos roxo |
| `--popover` | `261 52% 11%` | `252 15% 8%` | Idem |
| `--muted` | `261 40% 18%` | `255 12% 15%` | Cinza escuro dessaturado |
| `--input` | `261 40% 20%` | `255 12% 14%` | Idem |
| `--border` | `261 49% 23%` | `258 15% 18%` | Borda mais neutra |

**Sidebar - mesma abordagem:**

| Variavel | Antes | Depois |
|---|---|---|
| `--sidebar-background` | `261 52% 11%` | `252 15% 7%` |
| `--sidebar-accent` | `261 40% 18%` | `255 12% 15%` |
| `--sidebar-border` | `261 49% 23%` | `258 15% 18%` |

**Glass effects:**

| Variavel | Antes | Depois |
|---|---|---|
| `--glass-bg` | `261 52% 13% / 0.7` | `252 15% 10% / 0.75` |
| `--glass-border` | `261 49% 30% / 0.4` | `258 20% 25% / 0.4` |

**Manter inalterados** (elementos de destaque que continuam roxos):
- `--primary`, `--ring`, `--gradient-start/mid`, `--sidebar-primary`, `--sidebar-ring`
- `--secondary` (ambar), `--accent` (verde), `--destructive`

### Resultado esperado
- Fundos e cards quase pretos, com apenas um toque sutil de roxo
- Elementos interativos (botoes, links, badges) continuam vibrantes em violeta e ambar
- Melhor contraste e legibilidade
- Visual mais sofisticado e menos "monocromatico roxo"

### Arquivo editado
- `src/index.css` (somente o bloco `.dark`)
