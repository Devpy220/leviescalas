

## Melhorias no Sidebar, Remocao de Banners e Simplificacao do Departamento

### 1. Remover banner "Apoie o LEVI" das paginas

**Remover o `SupportNotification` global** do `src/App.tsx` (o banner animado que aparece no topo de todas as paginas). Manter apenas o banner animado dentro de Minhas Escalas.

**Remover os cards fixos "Apoie o LEVI"** do fundo das paginas:
- `src/pages/Dashboard.tsx`: remover o bloco "Support LEVI Section" (linhas 412-442)
- `src/pages/MySchedules.tsx`: remover o card "Support LEVI Card" (linhas 772-797) - manter apenas o banner animado do `SupportNotification` dentro dessa pagina

### 2. Sidebar: adicionar avatar do usuario em vez de "Dashboard" e subtitulo

**`src/components/DashboardSidebar.tsx`:**
- Aceitar novas props: `userName`, `userAvatarUrl`
- Logo abaixo do logo LEVI, adicionar texto: **"Logistica de Escalas para Voluntarios da Igreja"** em texto pequeno branco/50
- No item "Dashboard", substituir o texto por um avatar do usuario com nome ao lado (em vez de icone Home + "Dashboard")
- Manter os demais itens (Minhas Escalas, Apoie o LEVI)

**`src/pages/Dashboard.tsx`:** Passar `userName` e `userAvatarUrl` como props para `DashboardSidebar`

**`src/pages/MySchedules.tsx`:** Buscar nome/avatar do usuario e passar para `DashboardSidebar`

**`src/pages/Department.tsx`:** Buscar nome/avatar do usuario e passar para `DashboardSidebar`

### 3. Sidebar para lideres: botoes de acao no menu lateral (MySchedules)

**`src/components/DashboardSidebar.tsx`:**
- Aceitar props opcionais: `leaderActions` (array de acoes extras para o menu)
- Para lideres em Minhas Escalas: adicionar ao sidebar os botoes:
  - "Escala da Equipe" (toggle view mode)
  - "Minha Disponibilidade" (abre sheet)
  - "Criar Escala" (navega para departamento)

**`src/pages/MySchedules.tsx`:**
- Remover os botoes de acao (Escala da Equipe toggle, Minha Disponibilidade, Criar Escala) do conteudo principal
- Passar essas acoes como `leaderActions` para o sidebar

### 4. Simplificar informacoes no Departamento

**`src/pages/Department.tsx`:**
- Na aba de escalas para lideres: remover `LeaderSlotAvailabilityView` (disponibilidade detalhada por horarios) e `LeaderBlackoutDatesView` (datas de bloqueio) da visualizacao padrao
- Manter apenas o `UnifiedScheduleView` (calendario de escalas) como conteudo principal
- A disponibilidade e datas de bloqueio continuam acessiveis pelo ActionMenu (ja existente)

### 5. Remover botoes/menus soltos fora do sidebar

**`src/pages/MySchedules.tsx`:**
- Remover toggle "Minhas Escalas / Escala da Equipe" do conteudo - mover para sidebar
- Remover botoes "Minha Disponibilidade" e "Criar Escala" do conteudo - mover para sidebar

---

### Arquivos a editar

1. `src/App.tsx` - Remover `SupportNotification` global
2. `src/components/DashboardSidebar.tsx` - Avatar do usuario, subtitulo, acoes de lider
3. `src/pages/Dashboard.tsx` - Remover card "Apoie o LEVI", passar props de avatar
4. `src/pages/MySchedules.tsx` - Remover card "Apoie", remover botoes soltos, passar acoes para sidebar
5. `src/pages/Department.tsx` - Remover `LeaderSlotAvailabilityView` e `LeaderBlackoutDatesView` da aba escalas, passar props de avatar

### Detalhes tecnicos

**Novas props do DashboardSidebar:**
```typescript
interface DashboardSidebarProps {
  isAdmin: boolean;
  shouldShowInstallPrompt: boolean;
  onInstallClick: () => void;
  onSignOut: () => void;
  userName?: string;
  userAvatarUrl?: string | null;
  extraMenuItems?: Array<{
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    color?: string;
  }>;
}
```

**Avatar no sidebar:** O item "Dashboard" sera substituido por um avatar circular com o nome do usuario. Se nao houver foto, mostra iniciais com fundo ambar.

**Subtitulo abaixo do logo:**
```text
LEVI
Logistica de Escalas para
Voluntarios da Igreja
```
Em texto `text-white/50 text-[10px]` abaixo do logo.

