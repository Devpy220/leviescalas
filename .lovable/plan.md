

## Plano: Separar Rotas de Escalas + Sidebar Icon-Only + Ações de Líder na Sidebar

### Problemas Identificados

1. **"Escalas Equipe" não funciona** — O sidebar navega para `/my-schedules?view=team`, mas o `MySchedules` controla `viewMode` por estado interno, não lê o query param `?view=team`. Então sempre abre em "mine".

2. **Sidebar mostra texto** — Quando expandido/hovered, mostra labels. Usuário quer apenas ícones com tooltip no hover/toque.

3. **Menu hamburger no departamento** — O `ActionMenuPopover` ainda aparece no header do departamento para líderes.

4. **Ações de líder faltam na sidebar** — Itens como Setores, Funções, Resumo de Equipe, Convidar Membro e Exportar não estão na sidebar.

---

### 1. Corrigir navegação Escalas Equipe

**`src/pages/MySchedules.tsx`**: No `useEffect` inicial, ler `searchParams.get('view')` da URL e inicializar `viewMode` com esse valor. Quando `?view=team` estiver presente, setar `viewMode = 'team'` automaticamente.

---

### 2. Sidebar apenas com ícones + tooltip

**`src/components/DashboardSidebar.tsx`**: 
- Remover o comportamento de expansão por hover no desktop (remover `onMouseEnter`/`onMouseLeave` + `hovered` state)
- Sidebar fica sempre `w-14` (collapsed) tanto no mobile quanto no desktop
- Todos os itens sempre renderizados com `collapsed=true` (apenas ícone)
- Tooltip no hover/toque mostra o nome do item (já implementado quando `collapsed=true`)
- Remover o overlay de expansão mobile (`mobileExpanded` + `w-64` overlay)
- Remover botão de pin/collapse pois não há mais expansão
- Manter ThemeToggle e NotificationBell visíveis mesmo no modo collapsed (empilhados verticalmente)

---

### 3. Remover ActionMenuPopover do Departamento

**`src/pages/Department.tsx`**:
- Remover o `ActionMenuPopover` do header (linhas 481-491)
- Remover import do `ActionMenuPopover`
- Manter apenas o botão de Settings (engrenagem) para líderes

---

### 4. Adicionar ações de líder na sidebar

**`src/components/DashboardSidebar.tsx`**: Adicionar novos itens `leaderOnly` ao `menuItems`:

- `Layers` — **Setores** → abre modal com `SectorManagement` (novo contextual action)
- `UserCog` — **Funções** → abre modal com `AssignmentRoleManagement` (novo contextual action)
- `Users` — **Resumo Equipe** → abre modal com `ScheduleCountDialog` (novo contextual action)
- `UserPlus` — **Convidar Membro** → abre modal com `InviteMemberDialog` (novo contextual action)
- `Download` — **Exportar Escalas** → abre dropdown ou modal com opções PDF/Excel (novo contextual action)

Cada ação segue o mesmo padrão existente: se múltiplos departamentos de liderança, abre `DepartmentPicker` primeiro; se apenas um, abre direto o modal.

Adicionar novos tipos ao `ContextualAction`: `'sectors' | 'roles' | 'schedule-count' | 'invite' | 'export'`

Adicionar novos estados e modais correspondentes no componente principal `DashboardSidebar`.

---

### Arquivos Modificados

1. **`src/components/DashboardSidebar.tsx`** — Sidebar sempre icon-only, remover expansão, adicionar ações de líder (setores, funções, resumo, convidar, exportar)
2. **`src/pages/MySchedules.tsx`** — Ler `?view=team` da URL para inicializar viewMode
3. **`src/pages/Department.tsx`** — Remover ActionMenuPopover do header

