
# Plano: Seleção Múltipla de Membros na Criação de Escalas

## Resumo
Transformar o diálogo de criação de escalas (`AddScheduleDialog`) para permitir selecionar **múltiplos membros de uma vez**, e depois editar individualmente os setores e funções de cada um antes de salvar.

## Novo Fluxo de Trabalho

```text
┌─────────────────────────────────────────────────────────────────────┐
│  PASSO 1: Escolher Data e Horário                                   │
│  ┌─────────────────┐  ┌─────────────────┐                           │
│  │ 📅 Data: 02/02  │  │ ⏰ Domingo Noite│                           │
│  └─────────────────┘  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PASSO 2: Selecionar Membros (Checkboxes)                           │
│  ┌───────────────────────────────────────────────────┐              │
│  │ ☑ João Silva           ⚠️ (bloqueado)             │              │
│  │ ☑ Maria Santos                                    │              │
│  │ ☐ Pedro Costa                                     │              │
│  │ ☑ Ana Lima                                        │              │
│  │ ☐ Carlos Ferreira                                 │              │
│  └───────────────────────────────────────────────────┘              │
│  [3 membros selecionados]               [Selecionar Todos]          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PASSO 3: Configurar Cada Membro                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 👤 João Silva                                                 │  │
│  │    Setor: [Estacionamento ▼]  Função: [🚗 Plantão ▼]          │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │ 👤 Maria Santos                                               │  │
│  │    Setor: [Recepção ▼]        Função: [✅ Participante ▼]     │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │ 👤 Ana Lima                                                   │  │
│  │    Setor: [Som ▼]             Função: [Nenhuma ▼]             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Observações: [________________________]                            │
│                                                                     │
│                    [Cancelar]  [Criar 3 Escalas]                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Mudanças Detalhadas

### 1. Refatorar AddScheduleDialog

**Estado atual:**
- Seleciona 1 membro por vez
- Cria 1 escala por submit

**Novo estado:**
- Lista de membros com checkboxes para seleção múltipla
- Array de configurações individuais por membro selecionado
- Inserção em lote (batch insert) no Supabase

### 2. Estrutura de Dados

```typescript
interface MemberScheduleConfig {
  user_id: string;
  name: string;
  sector_id: string | null;
  assignment_role: string | null;
}

// Estado do componente
const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
const [memberConfigs, setMemberConfigs] = useState<Record<string, MemberScheduleConfig>>({});
```

### 3. Interface do Usuário

O diálogo será dividido em seções claras:

**Seção 1 - Data e Horário:**
- Calendário para escolher a data
- Badges de slots fixos para escolher o horário

**Seção 2 - Seleção de Membros:**
- Lista de todos os membros com checkboxes
- Indicador visual de membros bloqueados (⚠️)
- Botão "Selecionar Todos" / "Limpar Seleção"
- Contador de membros selecionados

**Seção 3 - Configuração Individual:**
- Para cada membro selecionado, mostrar:
  - Nome do membro (não editável)
  - Dropdown de Setor
  - Dropdown de Função (Plantão/Participante)
- Área de texto para observações gerais (compartilhada)

### 4. Lógica de Submissão

```typescript
const handleSubmit = async () => {
  // Validar que há membros selecionados
  if (selectedMembers.length === 0) {
    toast({ variant: 'destructive', title: 'Selecione ao menos um membro' });
    return;
  }

  // Criar array de escalas para inserção em lote
  const schedulesToInsert = selectedMembers.map(userId => ({
    department_id: departmentId,
    user_id: userId,
    date: format(date, 'yyyy-MM-dd'),
    time_start: timeStart,
    time_end: timeEnd,
    sector_id: memberConfigs[userId]?.sector_id || null,
    assignment_role: memberConfigs[userId]?.assignment_role || null,
    notes: notes || null,
    created_by: user?.id
  }));

  // Inserção em lote
  const { error } = await supabase
    .from('schedules')
    .insert(schedulesToInsert);
};
```

---

## Detalhes Técnicos

### Arquivo Modificado
`src/components/department/AddScheduleDialog.tsx`

### Componentes Utilizados
- `Checkbox` do Radix UI (já disponível em `src/components/ui/checkbox.tsx`)
- `ScrollArea` para lista de membros (se necessário)
- `Accordion` ou `Collapsible` para configuração individual (opcional)

### Importações Adicionais
```typescript
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
```

### Layout Responsivo
- Em telas pequenas: lista vertical com configurações inline
- Em telas maiores: possibilidade de grid para configurações

---

## Comportamento de Notificações
- O trigger `notify_on_schedule_insert` já existente será acionado automaticamente para cada escala inserida
- Não há necessidade de alterações no sistema de notificações

---

## Benefícios
1. **Velocidade**: Criar várias escalas de uma vez, economizando tempo
2. **Flexibilidade**: Configurar setor e função individualmente para cada membro
3. **Visibilidade**: Ver todos os membros e quem está bloqueado antes de escalar
4. **Consistência**: Mesmo horário para todos os membros selecionados

---

## Arquivos Impactados
| Arquivo | Mudança |
|---------|---------|
| `src/components/department/AddScheduleDialog.tsx` | Refatorar para seleção múltipla e configuração individual |
