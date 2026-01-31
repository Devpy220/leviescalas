
# Plano: Botões Flutuantes para Criação de Escalas

## Resumo

Transformar os botões "Gerar Escalas com IA" e "Adicionar Escala Manual" em **botões flutuantes de ícone** no canto inferior direito da tela, removendo-os do Card atual.

## Situação Atual

Os botões ocupam um Card inteiro com texto completo:

```text
┌────────────────────────────────────────────────────────────────┐
│  [ ✨ Gerar Escalas com IA ]  [ 📅 Adicionar Escala Manual ]  │
└────────────────────────────────────────────────────────────────┘
```

## Nova Interface

Dois botões flutuantes pequenos, empilhados verticalmente, no canto inferior direito:

```text
                                                    ┌─────┐
                                                    │ ✨  │  ← IA
                                                    └─────┘
                                                    ┌─────┐
                                                    │ 📅  │  ← Manual
                                                    └─────┘
```

### Comportamento
- **Posição fixa** no canto inferior direito (fixed bottom-right)
- **Apenas ícones** (sem texto)
- **Tooltips** aparecem ao passar o mouse mostrando a função
- **Design empilhado** - IA em cima, Manual embaixo
- **Cores distintas** - IA com cor primária/gradient, Manual com outline
- **Sombra e elevação** para efeito flutuante

### Interação
- Clique no botão de IA → Abre `SmartScheduleDialog`
- Clique no botão Manual → Abre calendário para selecionar data

---

## Mudança Técnica

### Arquivo: `src/components/department/UnifiedScheduleView.tsx`

**Remover o Card de ações do líder (linhas ~294-333)**

**Adicionar botões flutuantes fixos:**

```tsx
{/* Floating action buttons for leaders */}
{isLeader && (
  <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40">
    {/* Smart Schedule Button */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          size="icon"
          className="w-12 h-12 rounded-full shadow-lg gradient-vibrant hover:shadow-glow-sm transition-all"
          onClick={onOpenSmartSchedule}
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        Gerar Escalas com IA
      </TooltipContent>
    </Tooltip>
    
    {/* Manual Schedule Button */}
    <Popover open={showCalendarPicker} onOpenChange={setShowCalendarPicker}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button 
              size="icon"
              variant="outline"
              className="w-12 h-12 rounded-full shadow-lg bg-background hover:bg-accent transition-all"
            >
              <CalendarPlus className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          Adicionar Escala Manual
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto p-0" align="end" side="top">
        <Calendar ... />
      </PopoverContent>
    </Popover>
  </div>
)}
```

---

## Estilos

| Botão | Estilo |
|-------|--------|
| IA (Sparkles) | `gradient-vibrant` com sombra glow, posição superior |
| Manual (CalendarPlus) | `outline` com fundo background, posição inferior |

### Classes CSS
- `fixed bottom-6 right-6` - Posiciona no canto inferior direito
- `w-12 h-12 rounded-full` - Botões redondos de 48px
- `shadow-lg` - Sombra para efeito flutuante
- `z-40` - Acima do conteúdo normal

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/department/UnifiedScheduleView.tsx` | Remover Card de botões e adicionar botões flutuantes |

---

## Resultado Visual

Antes:
- Card ocupando largura total com dois botões grandes

Depois:
- Dois botões circulares pequenos flutuando no canto inferior direito
- Mais espaço para o grid de escalas
- Interface mais limpa e moderna
