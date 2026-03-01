

## Mais Cores na Landing Page e Geral

### Problema
A Landing page e outras areas estao muito monocromaticas em violeta. O usuario quer mais presenca das cores verde (emerald), laranja/ambar (secondary), e vermelho (rose/coral) espalhadas pela interface, especialmente na pagina inicial.

### Mudancas na Landing Page (`src/pages/Landing.tsx`)

**1. Hero Section - Mais cores nos elementos decorativos:**
- Badge "Simplifique..." trocar de `bg-primary/10 text-primary border-primary/20` para `bg-secondary/10 text-secondary border-secondary/20` (ambar)
- Avatares do contador de usuarios: alternar cores (violeta, ambar, emerald, rose) em vez de todos violeta
- Checkmarks na lista de features do "Apoio": alternar entre verde, ambar e violeta em vez de todos `gradient-vibrant`

**2. Features Section - Fundo com cor alternada:**
- Trocar fundo da secao de `bg-secondary/30` (ja ambar) para manter, mas adicionar borda decorativa
- Badge "Recursos" mudar para `bg-emerald/10 text-emerald` (verde)
- Titulo com destaque colorido: "Tudo que voce precisa" com palavra-chave em cor accent

**3. Support Section:**
- Badge "Apoie o Projeto" mudar para `bg-rose/10 text-rose` (rosa/vermelho)
- Coracao com gradiente rose em vez de violeta
- Botao "Apoie o LEVI" com gradiente rose/coral

**4. CTA Final Section:**
- Fundo com gradiente que mistura ambar e verde sutil (em vez de so secondary/20)
- Botao com borda ambar ou gradiente violeta-ambar

**5. Nav - Botao "Criar Conta":**
- Manter gradiente vibrant mas adicionar borda ambar sutil no hover

### Mudancas no CSS (`src/index.css`)

**Novos gradientes utilitarios:**
- `.gradient-warm`: gradiente de rose para ambar (para CTAs de apoio/doacao)
- `.gradient-fresh`: gradiente de emerald para cyan (para status/sucesso)

### Arquivos a editar:
1. `src/pages/Landing.tsx` - Distribuir cores verde, ambar e rosa nos elementos
2. `src/index.css` - Adicionar 2 novos gradientes utilitarios

