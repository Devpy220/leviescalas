
# Plano: Corrigir Exibição de Membros no Diálogo de Criação de Escalas

## Problema Identificado

O usuário relata que ao criar uma escala, só consegue ver **1 membro** para selecionar, quando deveria ver todos os **15 membros** do departamento.

Após investigação, confirmei que:
- ✅ O banco de dados está retornando **todos os 15 membros** corretamente
- ✅ A função RPC `get_department_member_profiles` funciona perfeitamente  
- ✅ As requisições de rede mostram todos os dados corretos

## Causa Raiz

O problema está no **layout CSS** do componente `AddScheduleDialog.tsx`. A área de scroll (`ScrollArea`) que contém a lista de membros tem altura calculada incorretamente:

```tsx
// Problema atual
<div className="space-y-2 flex-1 flex flex-col min-h-0">
  ...
  <ScrollArea className="flex-1 border rounded-md">
```

O `flex-1` combinado com `min-h-0` faz com que a altura do ScrollArea colapse para um valor muito pequeno, mostrando apenas 1 membro. O diálogo tem muitos elementos antes da lista (seletor de data, slots de horário, botão "Escalar Todos"), o que consome quase todo o espaço disponível.

## Solução

Definir uma **altura mínima e máxima** explícita para o `ScrollArea`:

```tsx
// Correção
<ScrollArea className="min-h-[180px] max-h-[300px] border rounded-md">
```

Isso garante que:
- Altura mínima de 180px (~4-5 membros visíveis)
- Altura máxima de 300px (~8-10 membros visíveis)
- O scroll interno funciona para ver todos os membros

## Mudança Técnica

### Arquivo: `src/components/department/AddScheduleDialog.tsx`

**Linha ~513:**
```tsx
// De:
<ScrollArea className="flex-1 border rounded-md">

// Para:
<ScrollArea className="min-h-[180px] max-h-[300px] border rounded-md">
```

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/department/AddScheduleDialog.tsx` | Adicionar altura mínima/máxima ao ScrollArea da lista de membros |

## Resultado Esperado

Após a correção:
- A lista de membros terá espaço adequado para exibir múltiplos membros
- O scroll permitirá navegar por todos os 15 membros
- O botão "Escalar Todos" continuará funcionando normalmente
