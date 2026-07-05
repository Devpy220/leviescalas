## Objetivo

Remover a sidebar lateral e trocá-la por um **botão flutuante circular com o logo LEVI** no canto inferior direito (estilo WhatsApp). Ao clicar, abre um menu com todos os itens que hoje estão na sidebar. Vale para todas as páginas que hoje usam a sidebar (Dashboard, Department, MySchedules, Security, Churches, ChurchDetail, Apoiar, etc.).

## Mudanças

### 1. Novo componente `src/components/FloatingActionMenu.tsx`
- Botão circular fixo (`fixed bottom-6 right-6 z-50`), ~`h-14 w-14`, `rounded-full`, sombra forte, com `<LeviLogo />` dentro.
- Reaproveita `DraggableFloating` (já existe no projeto) para permitir arrastar e persistir posição em `localStorage`.
- Ao clicar (sem drag), alterna um painel que sobe a partir do botão (`translate-y` + fade), com:
  - Cabeçalho: avatar + nome do usuário → navega para `/dashboard`.
  - Lista de ações agrupadas exatamente como a sidebar atual:
    - **Navegação**: Configurações (`/security`), Apoiar LEVI (`/apoiar`), Admin (se `isAdmin`).
    - **Departamento** (se tem depto): Disponibilidade, Avisos.
    - **Gestão** (se líder): Disponibilidade da Equipe, Criar Escala, Setores, Funções, Resumo, Convidar, Exportar, Configurações do Depto.
    - **Utilitários**: ThemeToggle, LanguageSelector, NotificationBell, Instalar App (se aplicável).
    - **Sair** (destaque em vermelho).
  - Fecha ao clicar fora (backdrop transparente) ou em qualquer item.
- Toda a lógica contextual (DepartmentPicker, modais de Disponibilidade, Avisos, AddSchedule, Setores, Funções, Resumo, Convite, Exportação, Configs, Team Availability) é migrada 1:1 do `DashboardSidebar.tsx` — sem alteração de comportamento nem de dados.

### 2. Aposentar `DashboardSidebar`
- Trocar todas as importações/usos de `<DashboardSidebar ... />` por `<FloatingActionMenu ... />` com as mesmas props (`isAdmin`, `shouldShowInstallPrompt`, `onInstallClick`, `onSignOut`).
- Remover os offsets `md:pl-56 / pl-16` (ou similares baseados em `sidebarWidth` do `SidebarContext`) das páginas — conteúdo passa a ocupar 100% da largura.
- `SidebarContext` / `useSidebarExpanded` deixam de ser usados nas páginas; podem ser mantidos por enquanto para não quebrar imports órfãos (limpeza opcional).
- Arquivo `DashboardSidebar.tsx` fica sem consumidores; pode ser removido depois de confirmada a build.

### 3. Estilo / UX
- Painel aberto: `w-72`, `rounded-2xl`, `bg-card/95 backdrop-blur-xl`, borda sutil, aparece acima do FAB.
- Ícone do FAB gira sutilmente (rotate-45) ou vira X quando aberto.
- Mobile: mesmo comportamento, painel `max-h-[70vh] overflow-y-auto`.
- Respeita tokens do design system (violet-600 / amber-400), sem cores hardcoded.

## Fora de escopo
- Nenhuma mudança em rotas, permissões, banco, notificações ou lógica de swap/escala.
- Sidebar do `DepartmentBySlug` interno (se houver componentes shadcn `Sidebar` em outras telas) não é afetada — só o `DashboardSidebar` global.
