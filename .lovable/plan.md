

## Plano: Menu Hamburger Estilo WhatsApp (Bandeja de Anexos)

### O que você quer

1. **Abrir o menu** ao passar o mouse OU clicar no ícone de 3 traços (hamburger)
2. **Fechar automaticamente** ao clicar fora (sem botão X)
3. **Visual similar** à bandeja de anexos do WhatsApp

### Referência Visual: WhatsApp Attachment Tray

```text
┌─────────────────────────────────────────────────────────┐
│  [Header do departamento]                      ☰ [≡]   │
└─────────────────────────────────────────────────────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    │   📅   📁   👥             │
                                    │                             │
                                    │   📥   ⏰   ➕             │
                                    └─────────────────────────────┘
                                           ↑
                                    Ícones em grid flutuante
                                    Fecha ao clicar fora
```

### Comparação: Antes vs Depois

| Aspecto | Antes (Sidebar) | Depois (Popover) |
|---------|-----------------|------------------|
| **Abertura** | Clique no hamburger | Hover OU clique no hamburger |
| **Fechamento** | Clique no X | Clique fora automaticamente |
| **Layout** | Sidebar fixa à esquerda | Popover flutuante |
| **Visual** | Lista vertical | Grid de ícones (2 colunas) |
| **Animação** | Slide da esquerda | Fade + scale (como WhatsApp) |

### Alterações Necessárias

#### 1. Transformar `ActionSidebar.tsx` em Popover

Trocar a sidebar fixa por um `Popover` que:
- Abre via hover (com delay) OU clique
- Fecha automaticamente ao clicar fora
- Mostra ícones em grid 2x3 ou 3x2
- Sem botão X

```typescript
// Nova estrutura usando Popover
<Popover open={isOpen} onOpenChange={onOpenChange}>
  <PopoverTrigger asChild>
    <Button 
      variant="ghost" 
      size="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Menu className="w-5 h-5" />
    </Button>
  </PopoverTrigger>
  <PopoverContent 
    side="bottom" 
    align="start"
    className="w-auto p-3"
  >
    <div className="grid grid-cols-3 gap-2">
      {/* Ícones de navegação e ações */}
    </div>
  </PopoverContent>
</Popover>
```

#### 2. Comportamento de Hover + Click

```typescript
// Abrir no hover após pequeno delay (300ms)
const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout>();

const handleMouseEnter = () => {
  const timeout = setTimeout(() => setIsOpen(true), 300);
  setHoverTimeout(timeout);
};

const handleMouseLeave = () => {
  clearTimeout(hoverTimeout);
  // Não fecha imediatamente - permite mover para o popover
};

// Também abre/fecha no click (toggle)
const handleClick = () => setIsOpen(!isOpen);
```

#### 3. Layout em Grid (Estilo WhatsApp)

```text
┌───────────────────────────┐
│  📅 Escalas  │  📁 Setores  │  👥 Membros  │  ← navegação
├───────────────────────────┤
│  📥 Exportar │  ⏰ Disp.    │  ➕ Convidar │  ← ações
└───────────────────────────┘
```

Ou em formato mais compacto (ícones maiores, sem texto):

```text
┌─────────────────┐
│  📅   📁   👥  │
│  📥   ⏰   ➕  │
└─────────────────┘
  ↑ apenas ícones
  Tooltip no hover
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/department/ActionSidebar.tsx` | Converter sidebar para Popover com grid |
| `src/pages/Department.tsx` | Integrar o Popover no hamburger do header |

### Detalhes Técnicos

#### ActionSidebar.tsx - Nova Estrutura

```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// O componente agora retorna apenas o conteúdo do menu
// O trigger (hamburger) fica no Department.tsx

export default function ActionMenuContent({
  departmentName,
  currentTab,
  onTabChange,
  onExportPDF,
  onExportExcel,
  onOpenAvailability,
  onOpenInvite,
  onClose,
}: ActionMenuProps) {
  return (
    <div className="p-2 space-y-2">
      {/* Navegação */}
      <div className="grid grid-cols-3 gap-2">
        {navigationItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-xl", // ícones maiores
                  item.color,
                  currentTab === item.id && "bg-accent ring-1 ring-primary/30"
                )}
                onClick={() => {
                  onTabChange(item.id);
                  onClose();
                }}
              >
                <item.icon className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{`${departmentName} - ${item.labelSuffix}`}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      
      {/* Divisor */}
      <div className="border-t border-border/50" />
      
      {/* Ações */}
      <div className="grid grid-cols-3 gap-2">
        {/* Export, Availability, Invite */}
      </div>
    </div>
  );
}
```

#### Department.tsx - Hamburger com Popover

```typescript
const [menuOpen, setMenuOpen] = useState(false);
const hoverTimeoutRef = useRef<NodeJS.Timeout>();

const handleMenuHoverEnter = () => {
  hoverTimeoutRef.current = setTimeout(() => setMenuOpen(true), 300);
};

const handleMenuHoverLeave = () => {
  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
};

// No header:
<Popover open={menuOpen} onOpenChange={setMenuOpen}>
  <PopoverTrigger asChild>
    <Button 
      variant="ghost" 
      size="icon"
      onMouseEnter={handleMenuHoverEnter}
      onMouseLeave={handleMenuHoverLeave}
    >
      <Menu className="w-5 h-5" />
    </Button>
  </PopoverTrigger>
  <PopoverContent 
    side="bottom" 
    align="start"
    sideOffset={8}
    className="w-auto p-0 bg-background/95 backdrop-blur-xl border-border/50"
    onMouseEnter={() => clearTimeout(hoverTimeoutRef.current)}
    onMouseLeave={() => setMenuOpen(false)}
  >
    <ActionMenuContent 
      departmentName={department.name}
      currentTab={activeTab}
      onTabChange={setActiveTab}
      onClose={() => setMenuOpen(false)}
      // ... demais props
    />
  </PopoverContent>
</Popover>
```

### Comportamento Mobile

No mobile, manter o Drawer atual (já funciona bem):
- Toque no hamburger abre drawer de baixo
- Arraste para baixo ou toque fora fecha

### Resumo das Mudanças

1. **Remover X** de fechar do menu
2. **Trocar sidebar** por Popover flutuante
3. **Adicionar hover** para abrir (com delay de 300ms)
4. **Layout em grid** 3 colunas com ícones grandes
5. **Fechar automático** ao clicar fora ou selecionar item

