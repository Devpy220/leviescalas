
# Correção: Mostrar Plantão/Culto na Página "Minhas Escalas"

## Problema Identificado

Na página **"Minhas Escalas"** (`/my-schedules`), o indicador de função (Plantão 🚗 ou Culto ✅) **não aparece** nos cards de escala.

### Causa Raiz

O campo `assignment_role` não está sendo:
1. Buscado do banco de dados na query
2. Incluído na interface TypeScript
3. Exibido na interface visual

A página de departamento (`Department.tsx`) já foi corrigida anteriormente, mas a página pessoal de escalas (`MySchedules.tsx`) ainda não foi atualizada.

---

## Solução

### 1. Adicionar `assignment_role` na interface Schedule

```typescript
interface Schedule {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  department_id: string;
  department_name: string;
  sector_name: string | null;
  sector_color: string | null;
  church_name: string | null;
  church_logo_url: string | null;
  assignment_role: string | null;  // ← NOVO
}
```

### 2. Incluir `assignment_role` na query do Supabase

```typescript
const { data: schedulesData, error: schedulesError } = await supabase
  .from('schedules')
  .select(`
    id,
    date,
    time_start,
    time_end,
    notes,
    department_id,
    sector_id,
    assignment_role,  // ← NOVO
    sectors(name, color)
  `)
  ...
```

### 3. Mapear o campo no objeto enriquecido

```typescript
const enrichedSchedules: Schedule[] = (schedulesData || []).map((s: any) => ({
  ...
  assignment_role: s.assignment_role || null,  // ← NOVO
}));
```

### 4. Exibir o indicador no card de escala

Adicionar um Badge colorido mostrando a função logo após o setor:

```tsx
{/* Assignment Role Badge */}
{schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role] && (
  <div className="flex items-center gap-1.5 text-sm">
    <span>{ASSIGNMENT_ROLES[schedule.assignment_role].icon}</span>
    <Badge 
      variant="outline" 
      className={ASSIGNMENT_ROLES[schedule.assignment_role].color}
    >
      {ASSIGNMENT_ROLES[schedule.assignment_role].label}
    </Badge>
  </div>
)}
```

---

## Resultado Esperado

Cada card de escala na página "Minhas Escalas" mostrará:

```text
┌────────────────────────────────────┐
│  DOM  01/02      [Logo Igreja]     │
│  ⏰ 08:00 - 12:00                  │
├────────────────────────────────────┤
│  [Ministério de Estacionamento]    │
│  🏛️ Igreja Exemplo                 │
│  🟢 Setor Principal                │
│  🚗 Plantão    ou    ✅ Culto      │  ← NOVO!
├────────────────────────────────────┤
│  [    🔄 Pedir Troca    ]          │
└────────────────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/MySchedules.tsx` | Adicionar `assignment_role` na interface, query, mapeamento e renderização |

---

## Detalhes Técnicos

### Import necessário

Adicionar import do `ASSIGNMENT_ROLES`:

```typescript
import { SUPPORT_PRICE_ID, ASSIGNMENT_ROLES } from '@/lib/constants';
```

### Localização do Badge no card

O badge de Plantão/Culto será exibido **após o setor** e **antes da seção de troca**, para manter a hierarquia visual do card.
