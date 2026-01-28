

## Plano: Mover Navegação Principal para o Menu Hamburger

### Situação Atual

As abas principais estão no topo da página:
- **Escalas** (calendário)
- **Setores** (só líderes)
- **Membros** (só líderes)

Já existe um menu hamburger com ações (Exportar, Disponibilidade, Convidar) no `ActionSidebar.tsx`.

### O que você quer

1. **Mover Escalas, Setores e Membros** para dentro do menu hamburger
2. **Renomear "Membros do Departamento"** para simplesmente **"Membros"**
3. **Incluir o nome do departamento** no label (ex: "Louvor - Membros")

### Nova Estrutura da Sidebar

```text
┌──────────────────────────────────────────────────┐
│  [X] Fechar                                      │
├──────────────────────────────────────────────────┤
│  📅 Louvor - Escalas          ← navegação        │
│  📁 Louvor - Setores          ← navegação        │
│  👥 Louvor - Membros          ← navegação        │
├──────────────────────────────────────────────────┤
│  📥 Exportar Escalas          ← ação             │
│  ⏰ Minha Disponibilidade     ← ação             │
│  ➕ Convidar Membro           ← ação             │
└──────────────────────────────────────────────────┘
```

### Alterações Necessárias

#### 1. Modificar `ActionSidebar.tsx`

Adicionar os itens de navegação (Escalas, Setores, Membros) com ícones coloridos:

| Ícone | Cor | Label | Ação |
|-------|-----|-------|------|
| `Calendar` | Roxo | "[Dept] - Escalas" | Navega para tab escalas |
| `Layers` | Amarelo | "[Dept] - Setores" | Navega para tab setores |
| `Users` | Cyan | "[Dept] - Membros" | Navega para tab membros |

Nova estrutura de props:

```typescript
interface ActionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;       // ← NOVO
  currentTab: string;           // ← NOVO
  onTabChange: (tab: string) => void; // ← NOVO
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
}
```

Itens de navegação:

```typescript
const navigationItems = [
  { 
    id: 'schedules',
    icon: Calendar, 
    labelSuffix: 'Escalas', 
    color: 'text-purple-500 hover:text-purple-400 hover:bg-purple-500/10',
  },
  { 
    id: 'sectors',
    icon: Layers, 
    labelSuffix: 'Setores', 
    color: 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10',
  },
  { 
    id: 'members',
    icon: Users, 
    labelSuffix: 'Membros', 
    color: 'text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10',
  },
];
```

#### 2. Modificar `Department.tsx`

- Controlar a tab ativa via estado (`activeTab`)
- Passar `onTabChange` para a sidebar
- Remover as abas visuais do topo para líderes (ou deixar apenas para membros)
- Passar `departmentName` e `currentTab` para a sidebar

```typescript
// Estado controlado da tab ativa
const [activeTab, setActiveTab] = useState('schedules');

// Passar para sidebar
<ActionSidebar
  departmentName={department.name}
  currentTab={activeTab}
  onTabChange={(tab) => setActiveTab(tab)}
  // ... demais props
/>

// Tabs sem a lista visual para líderes (conteúdo apenas)
<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* TabsList removida para líderes - navegação via sidebar */}
  {!isLeader && (
    <TabsList>
      {/* Mantém tabs visuais para membros */}
    </TabsList>
  )}
  
  <TabsContent value="schedules">...</TabsContent>
  <TabsContent value="sectors">...</TabsContent>
  <TabsContent value="members">...</TabsContent>
</Tabs>
```

#### 3. Layout Visual da Sidebar

**Desktop:** Sidebar fixa à esquerda com dois grupos visuais:
- **Navegação** (Escalas, Setores, Membros)
- **Ações** (Exportar, Disponibilidade, Convidar)

**Mobile:** Drawer com itens empilhados verticalmente

```text
Desktop:
┌────┐
│ X  │ ← fechar
├────┤
│ 📅 │ ← Escalas (ativo = fundo colorido)
│ 📁 │ ← Setores
│ 👥 │ ← Membros
├────┤ ← divisor visual
│ 📥 │ ← Exportar
│ ⏰ │ ← Disponibilidade
│ ➕ │ ← Convidar
└────┘
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/department/ActionSidebar.tsx` | Adicionar navegação + receber props novos |
| `src/pages/Department.tsx` | Controlar tab ativa + passar para sidebar + ocultar TabsList para líderes |

### Detalhes Técnicos

#### Indicador de Tab Ativa

Destacar o item ativo na navegação:

```typescript
<Button
  className={cn(
    item.color,
    currentTab === item.id && "bg-accent ring-1 ring-primary/30"
  )}
  onClick={() => onTabChange(item.id)}
>
```

#### Tooltip com Nome Completo

No hover (desktop), mostrar o label completo:

```text
Hover no ícone 📅 → "Louvor - Escalas"
Hover no ícone 👥 → "Louvor - Membros"
```

### Resultado Final

**Para Líderes:**
- Menu hamburger abre sidebar com navegação + ações
- Navegação inclui o nome do departamento
- Clique em item muda a view principal
- Tab bar tradicional é removida do topo

**Para Membros:**
- Mantém as tabs tradicionais (Escalas e Disponibilidade)
- Sem acesso ao menu hamburger

