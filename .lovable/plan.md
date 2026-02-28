

# Redesign LEVI - Nova Paleta Violeta + Ambar

## Resumo

Transformar o design system do LEVI da paleta atual (preto + laranja) para uma paleta vibrante violeta + ambar dourado, com glassmorphism aprimorado no dark mode, gradientes nos headers, e um visual moderno e acolhedor.

## Escopo das Mudancas

### 1. Variaveis CSS (`src/index.css`)

Atualizar todas as variaveis de cor em `:root` (light) e `.dark`:

**Light Mode:**
- `--background`: lavanda suave (#F5F0FF → `263 100% 97%`)
- `--card`: branco puro com sombra roxa
- `--primary`: violeta intenso (#7C3AED → `263 84% 58%`)
- `--accent`: verde esmeralda (#10B981)
- `--border`: #DDD6FE (violeta claro)
- `--foreground`: #1E1B4B (indigo profundo)
- `--muted-foreground`: #6B7280

**Dark Mode:**
- `--background`: roxo profundo (#0F0A1E → `260 53% 8%`)
- `--card`: #1A1033
- `--primary`: violeta claro (#A78BFA → `263 86% 76%`)
- `--border`: #2E2057
- `--foreground`: #F5F3FF
- `--muted-foreground`: #A5B4FC

Adicionar variaveis novas:
- `--secondary`: ambar (#F59E0B light / #FCD34D dark)
- `--success`, `--warning`, `--danger` mapeados para as novas cores

Atualizar as paletas `--violet-*`, `--orange-*` → violeta real, e `--blue-*` para indigo/violeta.

### 2. Classes Utilitarias (`src/index.css`)

- `.gradient-primary`: violeta para ambar (135deg)
- `.gradient-vibrant`: violeta intenso para violeta claro
- `.gradient-hero`: lavanda → violeta sutil (light), roxo profundo → violeta escuro (dark)
- `.mesh-gradient`: manchas violetas e ambares
- `.text-gradient` / `.text-gradient-vibrant`: gradiente violeta
- `.glass` / `.glass-strong`: aprimorar para dark mode com borda translucida violeta
- Sombras: trocar glow laranja por glow violeta
- `.shadow-glow`: violeta
- `.hover-lift`, `.hover-glow`, `.press-effect`: sombras violetas

### 3. ThemeToggle Animado (`src/components/ThemeToggle.tsx`)

- Substituir simples icone por toggle animado com transicao sol/lua
- Adicionar rotacao e escala na troca
- Fundo com pill colorida indicando o estado

### 4. Tailwind Config (`tailwind.config.ts`)

- Atualizar `boxShadow` glow para usar violeta
- Manter keyframes existentes (ja sao genericos)

### 5. Componentes que serao afetados automaticamente

Como os componentes usam variaveis CSS (`bg-primary`, `text-primary`, `gradient-vibrant`, etc.), a maioria sera atualizada automaticamente ao trocar as variaveis. Nao precisam de edição individual:
- Dashboard cards, buttons, badges
- Landing page hero, nav, CTAs
- Department page tabs, dialogs
- MySchedules cards

### 6. Memory do projeto

Atualizar a memoria de estilo para refletir a nova paleta violeta + ambar.

---

## Arquivos a Editar

1. **`src/index.css`** - Variaveis CSS (light + dark), classes utilitarias, gradientes, glass effects, sombras
2. **`tailwind.config.ts`** - Box shadows com violeta
3. **`src/components/ThemeToggle.tsx`** - Toggle animado sol/lua

## Detalhes Tecnicos

### Mapeamento de cores (hex → HSL)

```text
#F5F0FF → 263 100% 97%   (bg light)
#7C3AED → 263 84% 58%    (primary light)
#F59E0B → 38 92% 50%     (secondary/amber)
#10B981 → 160 84% 39%    (accent/emerald)
#1E1B4B → 244 46% 20%    (text primary light)
#DDD6FE → 253 85% 92%    (border light)

#0F0A1E → 260 53% 8%     (bg dark)
#1A1033 → 261 52% 13%    (card dark)
#A78BFA → 263 86% 76%    (primary dark)
#FCD34D → 46 96% 65%     (secondary dark)
#34D399 → 160 67% 52%    (accent dark)
#F5F3FF → 263 100% 97%   (text dark)
#A5B4FC → 229 94% 82%    (muted text dark)
#2E2057 → 261 49% 23%    (border dark)
```

### Gradientes principais

- Header/sections: `linear-gradient(135deg, #7C3AED, #F59E0B)` (violeta → ambar)
- CTA buttons: `linear-gradient(135deg, #7C3AED, #6D28D9, #8B5CF6)` (violeta range)
- Dark glass: `backdrop-blur + rgba(26,16,51,0.7) + border rgba(46,32,87,0.4)`

