

## Plano: Sidebar expansível com ícones + labels

### Resumo
Adicionar um botão de expandir/recolher na sidebar. Quando recolhida, fica como hoje (56px, apenas ícones com tooltips). Quando expandida, alarga para ~200px e mostra os nomes ao lado dos ícones.

### Mudanças

**1. `src/components/DashboardSidebar.tsx`**
- Adicionar estado `expanded` (default `false`), persistido em `localStorage`
- Botão toggle (ícone `ChevronRight`/`ChevronLeft`) no topo ou rodapé da sidebar
- Sidebar: `w-14` quando recolhida, `w-52` quando expandida, com `transition-all duration-300`
- `SidebarItem`: recebe prop `expanded` -- quando `true`, mostra label ao lado do ícone e remove tooltip; quando `false`, mantém comportamento atual (só ícone + tooltip)
- Logo, avatar, footer (ThemeToggle, NotificationBell) adaptam layout para modo expandido

**2. Páginas que usam `ml-14`** (5 arquivos)
- `Dashboard.tsx`, `MySchedules.tsx`, `Department.tsx`, `Security.tsx`, `Payment.tsx`
- Trocar `ml-14` fixo por margem dinâmica usando o valor exportado de `useSidebarWidth()`
- Atualizar `useSidebarWidth()` para retornar 56 ou 208 conforme o estado expandido

**3. Compartilhar estado**
- Usar contexto React ou `localStorage` + evento `storage` para sincronizar o estado `expanded` entre sidebar e páginas
- Abordagem simples: criar um pequeno contexto `SidebarExpandedProvider` no nível do layout, ou exportar um hook que lê `localStorage`

### Detalhes técnicos

```text
Recolhida (padrão):        Expandida:
┌──────┐                   ┌──────────────────┐
│ LOGO │                   │ LOGO    LEVI     │
│  👤  │                   │  👤  João Silva  │
│  📅  │                   │  📅  Escalas     │
│  👥  │                   │  👥  Equipe      │
│  ⚙️  │                   │  ⚙️  Config      │
│  ... │                   │  ...             │
│  ◀   │                   │  ▶  Recolher     │
└──────┘                   └──────────────────┘
 w-14 (56px)                w-52 (208px)
```

- Transição suave com `transition-all duration-300`
- Em mobile, manter recolhida por padrão (sem mudança no UX mobile)
- Tooltips desativados quando expandida (label visível)
- Estado salvo em `localStorage('sidebar-expanded')`

