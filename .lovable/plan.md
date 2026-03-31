

## Plano: Inverter lógica de disponibilidade para "disponível por padrão"

**Mudança principal**: Hoje o membro precisa ligar o switch para ficar disponível (opt-in). A nova lógica: todos os switches ligados por padrão. O membro só desliga o que NÃO pode.

No banco de dados, um registro na tabela `member_availability` com `is_available = true` significa "disponível". A ausência de registro significa "indisponível". Vamos inverter: a **ausência** de registro significa "disponível", e um registro com `is_available = false` significa "bloqueado".

### Arquivos alterados

**1. `src/components/department/SlotAvailability.tsx`**
- `isSlotAvailable()`: retorna `true` por padrão (sem registro = disponível). Só retorna `false` se existir registro com `is_available = false`
- `toggleSlotAvailability()`: ao desligar, insere/atualiza registro com `is_available = false`. Ao ligar, deleta o registro (volta ao padrão disponível)
- Contador: mostrar bloqueados em vez de disponíveis
- Texto explicativo: "Desative os dias que você NÃO pode servir"

**2. `src/components/department/AddScheduleDialog.tsx`** (linhas 120-128)
- Inverter a lógica do `blockedMembers`: bloqueia se `slotAvailabilityMap[key] === false` (registro explícito de bloqueio), em vez de bloquear quando não existe registro
- Buscar registros com `is_available = false` em vez de `true`

**3. `src/components/department/EditScheduleDialog.tsx`** (linhas 95-100, 166-176)
- Mesma inversão: buscar `is_available = false` e construir mapa de bloqueio
- `isMemberAvailable()`: retorna `true` por padrão, `false` apenas se existir no mapa de bloqueio

**4. `src/components/department/LeaderSlotAvailabilityView.tsx`** (linhas 51-78)
- Inverter: buscar registros `is_available = false` como mapa de bloqueio
- `getMembersForSlot()`: retornar todos os membros EXCETO os que têm bloqueio explícito para aquele slot

### Sem mudança no banco
Nenhuma migration necessária. A coluna `is_available` já suporta `false`. Apenas a interpretação muda no frontend.

### Resultado
- Membro novo entra com todos os dias disponíveis automaticamente
- Só precisa desligar os dias que não pode
- Texto na tela de disponibilidade: "Desative os dias que você NÃO pode servir"

