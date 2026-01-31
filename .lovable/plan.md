

# Plano: Seleção de Membros em Janela Separada

## Problema

O diálogo de criação de escalas tem muitos elementos (data, horário, botão "Escalar Todos") que ocupam espaço antes da lista de membros. Isso faz com que a lista de membros tenha pouco espaço visível, dificultando a seleção individual.

## Solução

Substituir a lista inline por **dois botões lado a lado**:
1. **Escalar Todos** - Seleciona todos os membros disponíveis (já existe)
2. **Selecionar Individualmente** - Abre uma **nova janela (Dialog)** com a lista completa de membros para seleção

## Nova Interface

```text
┌──────────────────────────────────────────────────────────────┐
│  📅 Data: Domingo, 02 de Fevereiro                           │
│  ⏰ Horário: Noite (18:00 - 22:00)                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │ 👥 ESCALAR TODOS        │  │ ☑️ SELECIONAR           │   │
│  │    (8 membros)          │  │    INDIVIDUALMENTE      │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
│                                                              │
│  Membros selecionados: 3                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐                                    │
│  │ JS  │ │ MC  │ │ AL  │  [Ver/Editar]                      │
│  └─────┘ └─────┘ └─────┘                                    │
│                                                              │
│                              [Cancelar]  [Continuar (3)]     │
└──────────────────────────────────────────────────────────────┘
```

### Janela de Seleção Individual (ao clicar no botão)

```text
┌─────────────────────────────────────────────────┐
│  Selecionar Membros                     [ X ]   │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │ ☑ João Silva                              │  │
│  │ ☑ Maria Costa                             │  │
│  │ ☐ Pedro Santos                            │  │
│  │ ☑ Ana Lima                                │  │
│  │ ☐ Carlos Ferreira                         │  │
│  │ ☐ Juliana Pereira        (Scroll ↓)      │  │
│  │ ☐ Roberto Gomes                           │  │
│  │ ☐ Fernanda Silva         🚫 Bloqueado    │  │
│  │ ...                                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Selecionar Todos]  [Limpar]    [Confirmar]   │
└─────────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### Arquivo: `src/components/department/AddScheduleDialog.tsx`

**1. Adicionar estado para controlar o sub-diálogo:**
```tsx
const [showMemberPicker, setShowMemberPicker] = useState(false);
```

**2. Substituir a lista inline (linhas ~478-558) por dois botões + preview:**

```tsx
{/* Action Buttons Row */}
<div className="grid grid-cols-2 gap-3 py-3 border-t border-b">
  {/* Schedule All Button */}
  <Button
    type="button"
    className="h-14 flex-col gap-1"
    variant="default"
    onClick={() => {
      selectAllAvailable();
      setStep('configure');
    }}
    disabled={availableMembers.length === 0}
  >
    <Users className="w-5 h-5" />
    <span className="text-xs">Escalar Todos ({availableMembers.length})</span>
  </Button>
  
  {/* Select Individually Button */}
  <Button
    type="button"
    variant="outline"
    className="h-14 flex-col gap-1"
    onClick={() => setShowMemberPicker(true)}
  >
    <CheckSquare className="w-5 h-5" />
    <span className="text-xs">Selecionar Individual</span>
  </Button>
</div>

{/* Selected Members Preview */}
{selectedMembers.length > 0 && (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm">
        {selectedMembers.length} membro{selectedMembers.length > 1 ? 's' : ''} selecionado{selectedMembers.length > 1 ? 's' : ''}
      </Label>
      <Button variant="link" size="sm" onClick={() => setShowMemberPicker(true)}>
        Editar
      </Button>
    </div>
    <div className="flex flex-wrap gap-2">
      {selectedMembers.slice(0, 8).map((userId) => {
        const member = getMemberById(userId);
        return (
          <Avatar key={userId} className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback>{member?.profile.name.slice(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
        );
      })}
      {selectedMembers.length > 8 && (
        <span className="text-sm text-muted-foreground">+{selectedMembers.length - 8}</span>
      )}
    </div>
  </div>
)}
```

**3. Adicionar o sub-diálogo de seleção de membros:**

```tsx
{/* Member Selection Dialog */}
<Dialog open={showMemberPicker} onOpenChange={setShowMemberPicker}>
  <DialogContent className="sm:max-w-[400px] max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>Selecionar Membros</DialogTitle>
      <DialogDescription>
        {availableMembers.length} disponíveis, {blockedMembers.size} bloqueados
      </DialogDescription>
    </DialogHeader>
    
    <ScrollArea className="h-[400px] border rounded-md">
      <div className="p-2 space-y-1">
        {members.map((member) => (
          // ... checkbox items com avatar e nome
        ))}
      </div>
    </ScrollArea>
    
    <div className="flex justify-between">
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={selectAllAvailable}>
          Selecionar Todos
        </Button>
        <Button variant="ghost" size="sm" onClick={clearSelection}>
          Limpar
        </Button>
      </div>
      <Button onClick={() => setShowMemberPicker(false)}>
        Confirmar ({selectedMembers.length})
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## Benefícios

1. **Mais espaço** - A janela separada tem altura dedicada (400px) para a lista
2. **Scroll claro** - Todos os membros visíveis com scroll fluido
3. **Fluxo limpo** - Dois caminhos claros: "todos" ou "individual"
4. **Preview** - Avatares mostram quem foi selecionado sem abrir a janela

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/department/AddScheduleDialog.tsx` | Adicionar sub-diálogo para seleção individual de membros |

