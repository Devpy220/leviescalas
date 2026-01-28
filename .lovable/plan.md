

## Plano: Reorganizar Menus com Barra Lateral de Ícones

### Situação Atual

Os botões de ação do líder estão espalhados no header:
- **Exportar** (dropdown com PDF/Excel)
- **Minha Disponibilidade** (abre sheet lateral)
- **Convidar Membro** (abre dialog)
- **Configurações** (ícone no header)

### O que você quer

1. **Menu hamburger** no header
2. **Barra lateral esquerda** com apenas ícones coloridos
3. **Tooltips** mostrando o nome ao hover/touch
4. Agrupar: Exportar + Minha Disponibilidade + Convidar Membros

### Nova Estrutura Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│  ☰  │ [Avatar] Departamento XYZ 👑 │      [🌙] [⚙️]            │
│     │        5 membros              │                           │
└─────────────────────────────────────────────────────────────────┘
  ↑ hamburger abre/fecha sidebar

┌──────┐ ┌───────────────────────────────────────────────────────┐
│      │ │                                                       │
│  📥  │ │                                                       │
│      │ │                    CONTEÚDO                           │
│  ⏰  │ │                    (tabs, calendário, etc)            │
│      │ │                                                       │
│  👥  │ │                                                       │
│      │ │                                                       │
└──────┘ └───────────────────────────────────────────────────────┘
   ↑ 
 Sidebar apenas ícones com cores
 Tooltip aparece no hover/touch
```

### Componentes da Sidebar

| Ícone | Cor | Ação | Tooltip |
|-------|-----|------|---------|
| `Download` | Verde | Dropdown exportar PDF/Excel | "Exportar Escalas" |
| `Clock` | Laranja/Primária | Abre sheet de disponibilidade | "Minha Disponibilidade" |
| `UserPlus` | Azul | Abre dialog de convidar | "Convidar Membro" |

### Alterações Necessárias

#### 1. Criar novo componente `ActionSidebar.tsx`

Sidebar minimalista à esquerda com:
- Fundo semi-transparente (glass effect)
- Apenas ícones coloridos
- Tooltips nativos do Radix
- Responsivo: em mobile, pode ser um bottom bar ou sheet

```typescript
// Estrutura básica
<aside className="fixed left-0 top-[64px] h-[calc(100vh-64px)] w-14 
  flex flex-col items-center py-4 gap-3 bg-background/80 backdrop-blur 
  border-r border-border/50 z-40">
  
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" className="text-green-500">
        <Download />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right">Exportar Escalas</TooltipContent>
  </Tooltip>
  
  {/* ... outros itens */}
</aside>
```

#### 2. Adicionar botão hamburger no header

```typescript
// No header de Department.tsx
<Button 
  variant="ghost" 
  size="icon" 
  onClick={() => setSidebarOpen(!sidebarOpen)}
>
  {sidebarOpen ? <X /> : <Menu />}
</Button>
```

#### 3. Remover botões do header atual

Mover os botões de exportar, disponibilidade e convidar para a sidebar.

#### 4. Ajustar layout principal

```typescript
<div className="flex">
  {sidebarOpen && <ActionSidebar />}
  <main className={cn(
    "flex-1 transition-all",
    sidebarOpen && "ml-14" // espaço para sidebar
  )}>
    {/* conteúdo atual */}
  </main>
</div>
```

### Comportamento Mobile

Em telas pequenas:
- Sidebar vira um **sheet/drawer** deslizante
- Ou uma **barra inferior** fixa com os ícones
- Touch nos ícones mostra tooltip brevemente antes de executar ação

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/components/department/ActionSidebar.tsx` | **Criar** - Nova sidebar com ícones |
| `src/pages/Department.tsx` | **Modificar** - Adicionar hamburger, integrar sidebar, remover botões antigos |

### Detalhes Técnicos

#### ActionSidebar.tsx - Estrutura Completa

```typescript
// Props
interface ActionSidebarProps {
  departmentId: string;
  userId: string;
  inviteCode: string;
  schedules: Schedule[];
  departmentName: string;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
}

// Itens com cores
const menuItems = [
  { 
    icon: Download, 
    label: 'Exportar Escalas', 
    color: 'text-green-500 hover:text-green-400',
    action: 'export' // dropdown
  },
  { 
    icon: Clock, 
    label: 'Minha Disponibilidade', 
    color: 'text-orange-500 hover:text-orange-400',
    action: 'availability'
  },
  { 
    icon: UserPlus, 
    label: 'Convidar Membro', 
    color: 'text-blue-500 hover:text-blue-400',
    action: 'invite'
  },
];
```

#### Estado da Sidebar em Department.tsx

```typescript
const [sidebarOpen, setSidebarOpen] = useState(true); // ou false por default

// Persistir preferência no localStorage
useEffect(() => {
  const saved = localStorage.getItem('dept-sidebar-open');
  if (saved !== null) setSidebarOpen(saved === 'true');
}, []);
```

### Resultado Final

**Desktop:**
- Hamburger no header para toggle
- Sidebar fina à esquerda com ícones coloridos
- Hover mostra tooltip com nome da ação
- Click executa a ação

**Mobile:**
- Hamburger abre drawer/sheet com os itens
- Touch longo ou hover mostra nome
- Tap executa ação

