
# Correções: Indicador de Plantão/Participante e Filtragem de Escalas para Membros

## Resumo dos Problemas

### Problema 1: Assignment Role não aparece
O campo `assignment_role` (Plantão 🚗 / Participante ✅) **não está sendo buscado do banco de dados**. Na função `fetchSchedules` em `Department.tsx`, a query não inclui esse campo:

```sql
-- Query atual (falta assignment_role):
select id, user_id, date, time_start, time_end, notes, sector_id, confirmation_status, decline_reason, sectors(name, color)

-- Query correta:
select id, user_id, date, time_start, time_end, notes, sector_id, assignment_role, confirmation_status, decline_reason, sectors(name, color)
```

### Problema 2: Membros veem todas as escalas
Atualmente, o componente `UnifiedScheduleView` exibe **todas as escalas para todos**. Membros deveriam ver **apenas seus próprios dias escalados**, enquanto líderes continuam vendo a escala completa.

---

## Solução

### 1. Incluir `assignment_role` na query de busca

**Arquivo:** `src/pages/Department.tsx`

Adicionar `assignment_role` na query do Supabase e no mapeamento dos dados formatados.

---

### 2. Passar `currentUserId` para o componente de visualização

**Arquivo:** `src/pages/Department.tsx`

Adicionar a prop `currentUserId` ao chamar `UnifiedScheduleView`:
```tsx
<UnifiedScheduleView 
  schedules={schedules}
  members={members}
  isLeader={isLeader}
  currentUserId={user?.id || ''}  // ← NOVO
  ...
/>
```

---

### 3. Filtrar escalas baseado no papel do usuário

**Arquivo:** `src/components/department/UnifiedScheduleView.tsx`

- Adicionar prop `currentUserId` na interface
- Quando `isLeader = false`, filtrar `schedules` para mostrar apenas onde `user_id === currentUserId`
- Atualizar o resumo do mês para refletir apenas as escalas do membro

---

### 4. Ajustar mensagem de estado vazio

**Arquivo:** `src/components/department/UnifiedScheduleView.tsx`

Quando um membro não tem escalas no mês, exibir mensagem apropriada:
- "Você não tem escalas para {mês}" (para membros)
- "Nenhuma escala para {mês}" (para líderes)

---

## Resultado Esperado

### Para Líderes:
- ✅ Veem **todas as escalas** da equipe
- ✅ Veem indicador de **Plantão 🚗** ou **Participante ✅** em cada membro
- ✅ Podem adicionar/remover escalas

### Para Membros:
- ✅ Veem **apenas seus próprios dias** de escala
- ✅ Veem seu indicador de função (Plantão/Participante)
- ✅ Não veem escalas de outros membros
- ✅ Não veem botões de adicionar/remover

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Department.tsx` | Incluir `assignment_role` na query e passar `currentUserId` como prop |
| `src/components/department/UnifiedScheduleView.tsx` | Aceitar `currentUserId` e filtrar escalas quando não for líder |

---

## Detalhes Técnicos

### Interface atualizada do componente:
```typescript
interface UnifiedScheduleViewProps {
  schedules: Schedule[];
  members: Member[];
  isLeader: boolean;
  currentUserId: string;  // ← NOVO
  departmentId: string;
  onAddSchedule: (date?: Date) => void;
  onDeleteSchedule: () => void;
  onOpenSmartSchedule: () => void;
}
```

### Lógica de filtragem:
```typescript
// Filtrar escalas baseado no papel
const visibleSchedules = useMemo(() => {
  if (isLeader) return schedules;
  return schedules.filter(s => s.user_id === currentUserId);
}, [schedules, isLeader, currentUserId]);
```

### Header ajustado para membros:
Para membros, o título muda de "Escalas de {mês}" para "Minhas Escalas de {mês}" para deixar claro que está vendo apenas suas próprias escalas.

### Esconder legenda de membros para não-líderes:
O card "Membros" (com a legenda de cores) será ocultado para membros comuns, já que eles só veem suas próprias escalas.
