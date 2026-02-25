

## Problema Identificado

O campo de quantidade de voluntarios por horario ja existe no codigo, mas tem dois problemas:

1. **Comportamento do input**: Quando o usuario tenta limpar o campo para digitar um novo numero, o valor volta imediatamente ao padrao por causa do operador `||` no `onChange` e no `value`. Isso impede a edicao.

2. **Scroll bloqueado**: O `DialogContent` tem `overflow-hidden`, entao se houver muitos slots (8 slots fixos), os inputs podem ficar fora da area visivel e inacessiveis.

## Solucao

### 1. Corrigir o Input para permitir edicao livre

- Mudar o `onChange` para aceitar valores vazios temporariamente (armazenar string vazia como valor intermediario)
- Usar `onBlur` para validar e aplicar o valor minimo quando o usuario sair do campo
- Trocar `Input type="number"` por botoes de incremento/decremento (+/-) que sao mais faceis de usar no mobile

### 2. Adicionar scroll na area de configuracao

- Adicionar `ScrollArea` ao conteudo do step "config" para garantir que todos os slots sejam acessiveis

### Detalhes Tecnicos

**Arquivo**: `src/components/department/SmartScheduleDialog.tsx`

**Mudancas**:

1. Substituir o `Input type="number"` por um controle com botoes `-` e `+` ao lado do numero, que funciona melhor no mobile e nao tem problemas de edicao:

```tsx
<div className="flex items-center gap-1">
  <Button variant="outline" size="icon" className="h-8 w-8"
    onClick={() => setSlotMembers(prev => ({
      ...prev, [slot.id]: Math.max(1, (prev[slot.id] || slot.defaultMembers) - 1)
    }))}>
    <Minus className="w-3 h-3" />
  </Button>
  <span className="w-8 text-center font-medium">
    {slotMembers[slot.id] || slot.defaultMembers}
  </span>
  <Button variant="outline" size="icon" className="h-8 w-8"
    onClick={() => setSlotMembers(prev => ({
      ...prev, [slot.id]: Math.min(10, (prev[slot.id] || slot.defaultMembers) + 1)
    }))}>
    <Plus className="w-3 h-3" />
  </Button>
</div>
```

2. Envolver o conteudo do step "config" em `ScrollArea` para garantir acesso a todos os campos.

3. Importar `Minus` e `Plus` de `lucide-react`.

