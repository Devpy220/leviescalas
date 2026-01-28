

## Plano: Corrigir Constraint para Suportar Múltiplos Períodos

### Problema Identificado

A tabela `member_availability` tem uma constraint única que **não inclui `period_start`**:

```text
Constraint atual:
UNIQUE (user_id, department_id, day_of_week, time_start, time_end)

O que acontece:
┌─────────────────────────────────────────────────────────────┐
│ Usuário tenta salvar para Janeiro 16-31:  ✅ Funciona      │
│ Usuário tenta salvar para Fevereiro 1-15: ❌ Erro!         │
│                                                             │
│ Erro: "duplicate key value violates unique constraint"     │
│                                                             │
│ O banco não diferencia períodos porque period_start        │
│ não faz parte da constraint única.                         │
└─────────────────────────────────────────────────────────────┘
```

### Solução

Atualizar a constraint única para incluir `period_start`, permitindo que o mesmo slot exista em períodos diferentes:

```text
Nova constraint:
UNIQUE (user_id, department_id, day_of_week, time_start, time_end, period_start)

Resultado esperado:
┌─────────────────────────────────────────────────────────────┐
│ Slot: Domingo Manhã (09:00-12:00), Usuário João             │
│                                                             │
│ period_start = 2026-01-16 → Registro 1 ✅                   │
│ period_start = 2026-02-01 → Registro 2 ✅ (agora permitido) │
└─────────────────────────────────────────────────────────────┘
```

### Alterações Necessárias

#### 1. Migração de Banco de Dados

Executar SQL para:
1. Remover a constraint antiga
2. Criar nova constraint incluindo `period_start`

```sql
-- Remover constraint antiga
ALTER TABLE member_availability 
DROP CONSTRAINT IF EXISTS member_availability_user_id_department_id_day_of_week_time__key;

-- Criar nova constraint com period_start
ALTER TABLE member_availability 
ADD CONSTRAINT member_availability_unique_slot_per_period 
UNIQUE (user_id, department_id, day_of_week, time_start, time_end, period_start);
```

#### 2. Nenhuma alteração no código frontend

O componente `SlotAvailability.tsx` já envia `period_start` corretamente no insert (linha 218). O problema é apenas a constraint do banco.

### Arquivos a Modificar

| Tipo | Alteração |
|------|-----------|
| **Migração SQL** | Atualizar constraint única para incluir `period_start` |
| **Frontend** | Nenhuma alteração necessária |

### Benefícios

- Membros podem salvar disponibilidade para o período atual E próximo período simultaneamente
- Cada período tem seus próprios registros independentes
- O sistema de reset quinzenal funciona corretamente (deleta registros antigos pelo `period_start`)

### Impacto nos Dados Existentes

Nenhum impacto negativo - os registros atuais continuarão funcionando normalmente. A nova constraint é mais permissiva.

