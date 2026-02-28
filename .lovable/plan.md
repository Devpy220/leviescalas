

## Problema

Atualmente, o sistema **nao bloqueia** membros que nao marcaram disponibilidade para um dia/horario especifico:

1. **EditScheduleDialog**: So verifica disponibilidade se o membro tem *algum* registro de disponibilidade. Se nao tem nenhum, considera disponivel (linha 175-182).
2. **AddScheduleDialog**: **Nao consulta** a tabela `member_availability` de forma alguma -- so verifica blackout dates e conflitos entre departamentos.

O comportamento correto e: se um membro **nao marcou** disponibilidade para aquele slot (dia + horario), ele deve aparecer como **indisponivel/bloqueado**.

---

## Plano de Implementacao

### 1. Corrigir EditScheduleDialog

Alterar a logica de `isMemberAvailable` (linha 166-183) para:
- Remover a condicao "se nao tem registros, considerar disponivel"
- Se o membro nao tem o slot especifico marcado como disponivel, ele e **indisponivel**
- Manter as verificacoes de blackout dates

Logica corrigida:
```
Se esta em blackout -> indisponivel
Se NAO tem registro de disponibilidade para dia+horario -> indisponivel
Se tem registro marcado como disponivel -> disponivel
```

### 2. Adicionar verificacao de disponibilidade no AddScheduleDialog

- Buscar dados de `member_availability` ao abrir o dialogo (junto com `fetchMemberBlackouts`)
- Criar um `availabilityMap` similar ao do EditScheduleDialog
- Adicionar membros sem disponibilidade ao conjunto de `blockedMembers`
- Atualizar o `useMemo` de `blockedMembers` para incluir membros sem slot disponivel para o dia/horario selecionado

### Detalhes tecnicos

**EditScheduleDialog.tsx** -- alterar `isMemberAvailable`:
```typescript
const isMemberAvailable = (userId: string): boolean => {
  if (!selectedDate || !timeStart) return true;
  const dayOfWeek = getDay(selectedDate);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  if (blackoutMap[userId]?.includes(dateStr)) return false;
  const key = `${userId}-${dayOfWeek}-${normalizeTime(timeStart)}`;
  return !!availabilityMap[key];
};
```

**AddScheduleDialog.tsx** -- adicionar:
1. State `slotAvailabilityMap` (Record de userId-day-time -> true)
2. Fetch de `member_availability` no `fetchMemberBlackouts` (ou funcao separada)
3. Atualizar `blockedMembers` para incluir membros sem disponibilidade no slot selecionado
4. Exibir indicacao visual (icone de alerta) nos membros bloqueados por falta de disponibilidade

