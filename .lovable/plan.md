
## Redesign da Navegacao e Cores - Landing e Dashboard

### Resumo
Adicionar mais variedade de cores nos menus e botoes, e remodelar a navegacao do Dashboard com um menu lateral vertical inspirado na imagem de referencia (gradiente roxo, item ativo com destaque ambar, icones brancos). No tema claro, o fundo tera um mix de roxo claro com branco.

### 1. Fundo do Tema Claro (`src/index.css`)

Ajustar o `--background` para ser mais branco com toque lavanda:
- `--background`: de `263 100% 97%` para `270 50% 98%` (quase branco com leve toque roxo)
- `--card`: manter branco puro `0 0% 100%`
- Adicionar variavel `--sidebar-gradient-start` e `--sidebar-gradient-end` para o gradiente do menu lateral

### 2. Menu Lateral no Dashboard (`src/pages/Dashboard.tsx`)

Transformar o header horizontal em um layout com sidebar vertical no estilo da imagem:

**Estrutura:**
```text
+------------------+----------------------------------+
| SIDEBAR          |  CONTEUDO PRINCIPAL              |
| (gradiente roxo) |                                  |
|                  |                                  |
| [Logo LEVI]      |  Ola, [nome]!                   |
|                  |                                  |
| PRINCIPAL        |  [Cards de departamentos]        |
| > Dashboard (amb)|                                  |
| > Escalas     (3)|                                  |
| > Configuracoes  |                                  |
|                  |                                  |
| [Sair]           |                                  |
+------------------+----------------------------------+
```

- Sidebar com `gradient-vibrant` (roxo)
- Logo LEVI no topo com fundo ambar arredondado
- Label "PRINCIPAL" em branco/50 uppercase
- Items do menu com icones brancos
- Item ativo com pill ambar (bg-secondary, texto escuro)
- Badge de notificacao em vermelho/coral
- No mobile: sidebar vira um drawer/sheet

**Cores dos itens do menu:**
- Dashboard: icone Home, ativo = pill ambar
- Escalas: icone Calendar, badge vermelho com contagem
- Configuracoes: icone Settings, cor neutra
- Sair: icone LogOut, cor vermelha/rose

### 3. Botoes Menos Roxos (`src/pages/Landing.tsx` e `Dashboard.tsx`)

- Botao "Criar Conta" (Landing): manter gradiente vibrant (ja e o CTA principal)
- Botao "Entrar" (Landing): trocar de `border-primary text-primary` para `border-secondary text-secondary` (ambar)
- Botao "Ver demonstracao": adicionar borda ambar sutil
- Botao "Acessar com Codigo" (Landing hero): trocar de `gradient-vibrant` para `bg-secondary text-secondary-foreground` (ambar dourado)
- Botao "Apoie o LEVI": manter `gradient-warm` (rose) - ja esta bom
- Botao "Criar Departamento" (Dashboard): trocar para gradiente ambar-verde em vez de `gradient-vibrant`
- Botoes de acao do header: manter ghost/neutro

### 4. Landing Page (`src/pages/Landing.tsx`) - Mais cores

- Nav: botao "Entrar" com cor ambar, "Criar Conta" com gradiente violeta-ambar
- Hero badge: manter ambar (ja ajustado)
- Botao principal do hero: ambar dourado (secundario) em vez de roxo
- Secao Screenshots: badge "Veja como funciona" com cor emerald
- Secao CTA final: botao com gradiente ambar

### 5. Pagina Index (`src/pages/Index.tsx`) - Mais cores

- Badge "Gestao de Escalas": trocar para ambar
- Icone Church: trocar para cor emerald
- Botao "Continuar": trocar de `gradient-vibrant` para `bg-secondary` (ambar)

---

### Arquivos a editar

1. **`src/index.css`** - Ajustar background light mais branco
2. **`src/pages/Dashboard.tsx`** - Sidebar vertical com gradiente, itens coloridos, layout responsivo
3. **`src/pages/Landing.tsx`** - Botoes com mais variedade de cores
4. **`src/pages/Index.tsx`** - Botoes e badges com cores variadas

### Detalhes tecnicos

**Sidebar (Desktop):** `w-64 fixed left-0 top-0 bottom-0` com gradiente roxo. Conteudo principal com `ml-64`.

**Sidebar (Mobile):** Componente Sheet/Drawer que abre por botao hamburger no header.

**Gradiente da sidebar:** `linear-gradient(180deg, hsl(263 84% 58%) 0%, hsl(263 76% 42%) 100%)` - vertical de violeta claro para escuro.

**Item ativo:** `bg-secondary text-secondary-foreground rounded-xl px-4 py-3` - pill ambar com texto escuro.
