## Sidebar nas paginas internas + Cores nos botoes de login

### Resumo

Aplicar o menu lateral (`DashboardSidebar`) nas paginas **Minhas Escalas**, **Departamento e Criar escala**, substituindo os headers horizontais atuais. Tambem adicionar cores variadas nos botoes da pagina de login/cadastro (`/auth`).

---

### 1. Minhas Escalas (`src/pages/MySchedules.tsx`)

**Antes:** Header horizontal com botao voltar, logo, ThemeToggle, NotificationBell, SettingsButton.

**Depois:** Usar `DashboardSidebar` igual ao Dashboard:

- Remover o `<header>` inteiro (linhas 382-418)
- Envolver o conteudo com `DashboardSidebar` + wrapper `ml-64` (desktop) / sem margin (mobile)
- Importar `DashboardSidebar`, `useAdmin`, `usePWAInstall`, `useIsMobile`
- Adicionar handlers para signOut e installClick
- Mover ThemeToggle/NotificationBell/SettingsButton para dentro da sidebar (ja estao la)

### 2. Departamento (`src/pages/Department.tsx`)

**Antes:** Header horizontal com ActionMenuPopover, botao voltar, avatar, ThemeToggle, Settings.

**Depois:** Usar `DashboardSidebar`:

- Remover o `<header>` (linhas 453-532)
- Adicionar `DashboardSidebar` com wrapper `ml-64`
- Manter o ActionMenuPopover e controles do departamento como uma barra interna (sub-header) dentro do conteudo principal, nao no header global
- O sub-header tera: avatar do departamento, nome, badge de lider, e botoes de acao (Settings, ActionMenu)

### 3. Auth (`src/pages/Auth.tsx`) - Mais cores nos botoes

Atualmente todos os botoes de submit usam `gradient-vibrant` (roxo). Diversificar:

- **Botao "Entrar"** (login): Trocar de `gradient-vibrant` para `bg-secondary text-secondary-foreground` (ambar dourado) - linha 1072
- **Botao "Criar conta"** (register): Manter `gradient-vibrant` (roxo) - e o CTA principal
- **Botao "Enviar link de recuperacao"**: Trocar para `gradient-fresh` (verde/emerald) - linha 1369
- **Botao "Redefinir senha"**: Trocar para `gradient-warm` (rose/ambar) - linha 1446
- **Logo icon** (linha 975): Trocar de `gradient-vibrant` para `bg-secondary` (ambar)
- **Botoes sociais** (Google/Apple): Adicionar borda colorida sutil - `border-secondary/30 hover:border-secondary/50`

### 4. Landing (`src/pages/Landing.tsx`) - Ajustes adicionais

- **Botao "Criar Conta" no nav** (linha 154): Manter `gradient-vibrant`
- **Botao "Ver demonstracao"** (linha 195): Adicionar `border-secondary/50 text-secondary hover:bg-secondary/10`

---

### Arquivos a editar

1. `src/pages/MySchedules.tsx` - Substituir header por DashboardSidebar + layout ml-64
2. `src/pages/Department.tsx` - Substituir header por DashboardSidebar + sub-header interno
3. `src/pages/Auth.tsx` - Diversificar cores dos botoes de submit e social
4. `src/pages/Landing.tsx` - Ajuste no botao "Ver demonstracao"

### Detalhes tecnicos

**Layout com sidebar (MySchedules e Department):**

```text
<div className="min-h-screen bg-background">
  <DashboardSidebar ... />
  <div className={isMobile ? '' : 'ml-64'}>
    <main>...</main>
  </div>
</div>
```

**Sub-header do Departamento (dentro do conteudo):**
Sera uma barra simples com avatar, nome do departamento, badge de lider, e botoes de acao - sem ser sticky, apenas no topo do conteudo.