
# Escala da Equipe: Agrupar por Dia/Slot (como o Líder vê)

## Problema Atual

Na aba "Escala da Equipe" em Minhas Escalas, as escalas são exibidas **separadas por pessoa** - cada voluntário tem seu próprio card. Isso não corresponde à visualização que o líder tem no departamento.

## Solução

Reaproveitar a lógica de agrupamento do `UnifiedScheduleView` para mostrar as escalas **agrupadas por dia e horário**, com todos os voluntários escalados naquele turno listados dentro do mesmo card.

---

## Interface Proposta

```text
┌─────────────────────────────────────────────────┐
│  [👤 Minhas Escalas]  [👥 Escala da Equipe]     │
└─────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ DOMINGO MANHÃ    │  │ QUARTA           │  │ DOMINGO NOITE    │
│ 02 de fevereiro  │  │ 05 de fevereiro  │  │ 09 de fevereiro  │
│ ⏰ 08:00 - 12:00 │  │ ⏰ 19:00 - 22:00 │  │ ⏰ 18:00 - 22:00 │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ 🟢 VOCÊ ⭐       │  │ 🔵 João          │  │ 🟢 VOCÊ ⭐       │
│    🚗 Plantão    │  │    ⛪ Culto      │  │    ⛪ Culto      │
│ 🔴 Maria         │  │ 🟣 Pedro         │  │ 🟡 Carlos        │
│    ⛪ Culto      │  │    🚗 Plantão    │  │    🚗 Plantão    │
│ 🟡 Carlos        │  └──────────────────┘  │ 🔴 Maria         │
│    ⛪ Culto      │                        │    ⛪ Culto      │
├──────────────────┤                        ├──────────────────┤
│ [🔄 Pedir Troca] │                        │ [🔄 Pedir Troca] │
└──────────────────┘                        └──────────────────┘
```

---

## Mudanças Técnicas

### 1. Importar estruturas do fixedSlots

```typescript
import { FIXED_SLOTS, FixedSlot } from '@/lib/fixedSlots';
```

### 2. Criar interface para grupos de slot

```typescript
interface SlotGroup {
  date: Date;
  slotInfo: FixedSlot;
  schedules: Schedule[];
}
```

### 3. Lógica de agrupamento (apenas no modo team)

Reaproveitar a mesma lógica do `UnifiedScheduleView`:
- Agrupar escalas por data + horário de início
- Identificar slot fixo correspondente (Domingo Manhã, Domingo Noite, etc.)
- Ordenar grupos por data e depois por horário

### 4. Renderização condicional

```tsx
{viewMode === 'mine' ? (
  // Grid atual de cards individuais
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {schedules.map((schedule) => (
      <ScheduleCard ... />
    ))}
  </div>
) : (
  // Novo: Grid de cards agrupados por slot
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {slotGroups.map((group) => (
      <TeamSlotCard 
        group={group}
        currentUserId={user.id}
        memberProfiles={memberProfiles}
        onRequestSwap={handleOpenSwapDialog}
      />
    ))}
  </div>
)}
```

### 5. Componente TeamSlotCard

Novo componente que exibe:
- Header colorido com nome do slot (Domingo Manhã, Quarta, etc.)
- Data formatada (2 de fevereiro)
- Horário (08:00 - 12:00)
- Lista de voluntários escalados
- **Destaque verde** para o usuário logado + badge "⭐ Você"
- Botão "Pedir Troca" **apenas** se o usuário estiver escalado naquele slot

### 6. Membro com destaque no card

```tsx
<div className={cn(
  "flex items-center gap-2 p-2 rounded-md border-l-4",
  isCurrentUser && "bg-green-100 dark:bg-green-900/40"
)}>
  <Avatar>...</Avatar>
  <div>
    <span className={cn(
      "font-medium text-sm",
      isCurrentUser && "text-green-700 dark:text-green-400"
    )}>
      {isCurrentUser ? "Você" : memberName}
      {isCurrentUser && <span className="ml-1">⭐</span>}
    </span>
    {/* Badge de função: Plantão/Culto */}
  </div>
</div>
```

---

## Arquivo a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/MySchedules.tsx` | Adicionar lógica de agrupamento, criar componente TeamSlotCard, renderização condicional por modo |

---

## Resultado Esperado

1. **Minhas Escalas**: Mantém comportamento atual (cards individuais por escala)
2. **Escala da Equipe**: Cards agrupados por dia/horário como o líder vê
   - Cada card mostra todos os voluntários daquele turno
   - Você aparece com fundo verde e badge "⭐ Você"
   - Botão "Pedir Troca" aparece **somente nos cards onde você está escalado**
