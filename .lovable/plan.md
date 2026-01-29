

## Plano: Adicionar Função/Papel na Escala

### Objetivo

Permitir que o líder identifique qual é a **função específica** de cada pessoa escalada no dia. Por exemplo, no ministério de estacionamento:
- **Plantão**: Fica cuidando dos carros (não participa do culto)
- **Participante**: Ajuda no início e pode participar do culto depois

Isso resolve o problema de saber quem vai ficar de fora e quem pode entrar no culto.

### Fluxo de Uso

```text
┌─────────────────────────────────────────────────────────────┐
│  CRIAR ESCALA                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Membro:    [João Silva         ▼]                    │   │
│  │ Horário:   [Domingo Noite      ▼]                    │   │
│  │ Função:    [🚗 Plantão        ▼]  ← NOVO CAMPO       │   │
│  │            [✅ Participante      ]                    │   │
│  │            [📋 Horário personalizado]                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Exibição Visual

| Antes | Depois |
|-------|--------|
| João 🟢 18:00-22:00 | João 🚗 **Plantão** 🟢 18:00-22:00 |
| Maria 🟡 18:00-22:00 | Maria ✅ **Participa** 🟡 18:00-22:00 |

### Estrutura de Dados

**Nova coluna na tabela `schedules`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `assignment_role` | text | "on_duty" (plantão), "participant" (participante), ou NULL (padrão) |

### Componentes a Modificar

| Componente | Mudança |
|------------|---------|
| `AddScheduleDialog.tsx` | Adicionar seletor de função |
| `ScheduleTable.tsx` | Exibir ícone e label da função |
| `ScheduleCalendar.tsx` | Exibir função no dialog de detalhes |
| `UnifiedScheduleView.tsx` | Exibir função na visualização unificada |
| `SmartScheduleDialog.tsx` | Adicionar opção de função padrão |

### Detalhes da Implementação

#### 1. Migração de Banco de Dados

```sql
-- Adicionar coluna para função/papel na escala
ALTER TABLE schedules 
ADD COLUMN assignment_role TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN schedules.assignment_role IS 
'Papel do membro na escala: on_duty (plantão/fica o tempo todo), participant (pode participar do culto), NULL (não definido)';
```

#### 2. Constantes de Funções

Criar um mapeamento de funções com ícones e labels:

```typescript
const ASSIGNMENT_ROLES = {
  on_duty: { 
    label: 'Plantão', 
    description: 'Fica o tempo todo (não participa do culto)',
    icon: '🚗', // ou Shield, Car, Eye
    color: 'text-amber-600'
  },
  participant: { 
    label: 'Participante', 
    description: 'Pode participar do culto',
    icon: '✅', // ou Users, Church
    color: 'text-green-600'
  }
};
```

#### 3. AddScheduleDialog - Novo Campo

Adicionar um `Select` após o setor:

```tsx
<div className="space-y-2">
  <Label className="flex items-center gap-2">
    <UserCog className="w-4 h-4 text-muted-foreground" />
    Função (opcional)
  </Label>
  <Select value={assignmentRole} onValueChange={setAssignmentRole}>
    <SelectTrigger>
      <SelectValue placeholder="Sem função específica" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Sem função específica</SelectItem>
      <SelectItem value="on_duty">🚗 Plantão - Fica o tempo todo</SelectItem>
      <SelectItem value="participant">✅ Participante - Pode ir ao culto</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### 4. Exibição nas Escalas

Na `ScheduleTable` e outros componentes, exibir a função com ícone:

```tsx
{schedule.assignment_role && (
  <Badge variant="outline" className="text-[8px] px-1">
    {schedule.assignment_role === 'on_duty' ? '🚗 Plantão' : '✅ Participa'}
  </Badge>
)}
```

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_add_assignment_role.sql` | Criar migração |
| `src/lib/constants.ts` | Adicionar constantes de funções |
| `src/components/department/AddScheduleDialog.tsx` | Adicionar seletor |
| `src/components/department/ScheduleTable.tsx` | Exibir função |
| `src/components/department/ScheduleCalendar.tsx` | Exibir no dialog |
| `src/components/department/UnifiedScheduleView.tsx` | Exibir na visualização |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

### Resultado Esperado

Após implementação, o líder poderá:
1. Ao criar uma escala, selecionar se a pessoa fica de **Plantão** ou pode **Participar**
2. Visualizar nas escalas um ícone indicando a função de cada pessoa
3. Identificar rapidamente quem fica e quem entra no culto

