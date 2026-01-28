

## Plano: Disponibilidade Semanal para o Mês Seguinte

### Problema Atual

A disponibilidade semanal (`SlotAvailability`) só permite marcar para o período atual do mês:
- Período 1: Dias 1-15
- Período 2: Dias 16-31

Os usuários não conseguem se adiantar e marcar disponibilidade para o próximo mês.

### Solução Proposta

Adicionar **abas de período** no componente `SlotAvailability` para que os usuários possam alternar entre:

1. **Período Atual** - Comportamento existente
2. **Próximo Período** - Pode ser a próxima quinzena ou o início do próximo mês

```text
┌─────────────────────────────────────────────────────────┐
│  Disponibilidade Semanal                                │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ Janeiro 16-31  │  │ Fevereiro 1-15 │  ← Abas        │
│  │   (atual)      │  │  (próximo)     │                 │
│  └────────────────┘  └────────────────┘                 │
│                                                         │
│  ⚠️ Válida até 31 de Janeiro                           │
│                                                         │
│  [Domingo Manhã]     ────────────────────  [ ON/OFF ]   │
│  [Domingo Noite]     ────────────────────  [ ON/OFF ]   │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Alterações Necessárias

#### 1. Atualizar `SlotAvailability.tsx`

- Adicionar estado para controlar qual período está selecionado (atual ou próximo)
- Criar função para calcular o próximo período
- Adicionar tabs/botões para alternar entre períodos
- Ajustar as queries para filtrar pelo período selecionado

#### 2. Atualizar `LeaderSlotAvailabilityView.tsx`

- Adicionar mesma lógica de abas para o líder ver disponibilidade do período atual e próximo
- Permitir que o líder planeje escalas antecipadamente

### Detalhes Técnicos

**Cálculo do Próximo Período:**
```text
Se hoje = 20 de Janeiro (período 16-31):
  - Próximo período = 1-15 de Fevereiro
  
Se hoje = 10 de Janeiro (período 1-15):
  - Próximo período = 16-31 de Janeiro
```

**Estrutura do `period_start` no banco:**
- O campo `period_start` já existe na tabela `member_availability`
- Apenas precisamos permitir inserir registros com `period_start` futuro

**Não há alterações no banco de dados** - a estrutura atual já suporta múltiplos períodos.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/department/SlotAvailability.tsx` | Adicionar tabs de período e lógica de período futuro |
| `src/components/department/LeaderSlotAvailabilityView.tsx` | Adicionar tabs para líder visualizar períodos |

### Benefícios

- Membros podem se adiantar e marcar disponibilidade
- Líderes podem planejar escalas com antecedência
- Mantém o sistema de reset quinzenal funcionando normalmente
- Não requer mudanças no banco de dados

