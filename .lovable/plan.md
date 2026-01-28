

## Plano: Corrigir Cores e Iniciais dos Avatares de Membros

### Problema Identificado

Há 3 componentes que exibem avatares de membros com:
- **Cor fixa** (`bg-primary/10` ou `bg-primary/20`) em vez da cor única atribuída a cada membro
- As iniciais já estão corretas (usando nome), mas as cores não seguem o sistema de cores

### Componentes Afetados

| Componente | Problema | Linha |
|------------|----------|-------|
| `LeaderSlotAvailabilityView.tsx` | Usa `bg-primary/10` | 271 |
| `LeaderAvailabilityView.tsx` | Usa `bg-primary/20` | 278 |
| `SmartScheduleDialog.tsx` | Usa `bg-primary/20` | 488 |

### Solução

Atualizar cada componente para:
1. Importar o sistema de cores: `createExtendedMemberColorMap`, `getMemberBackgroundStyle`
2. Criar um mapa de cores baseado nos membros
3. Aplicar a cor correta via `style={getMemberBgStyle(userId)}`
4. Ajustar a cor do texto para branco (`text-white`)

### Alterações por Arquivo

#### 1. `src/components/department/LeaderSlotAvailabilityView.tsx`

**Adicionar imports:**
```typescript
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';
```

**Criar mapa de cores:**
```typescript
const memberColorMap = useMemo(() => {
  // Converter membros para o formato esperado
  const membersForColor = members.map(m => ({
    id: m.id,
    user_id: m.id, // profile.id é o user_id
    profile: { name: m.name }
  }));
  return createExtendedMemberColorMap(membersForColor);
}, [members]);

const getMemberBgStyle = (userId: string): React.CSSProperties => {
  return getMemberBackgroundStyle(memberColorMap, userId);
};
```

**Modificar AvatarFallback (linha 271):**
```typescript
// De:
<AvatarFallback className="text-xs bg-primary/10">

// Para:
<AvatarFallback 
  className="text-xs font-bold text-white"
  style={getMemberBgStyle(member.id)}
>
```

#### 2. `src/components/department/LeaderAvailabilityView.tsx`

Mesma lógica - adicionar sistema de cores e aplicar `style` no AvatarFallback.

#### 3. `src/components/department/SmartScheduleDialog.tsx`

Mesma lógica - o componente já recebe dados de membros, então apenas precisa integrar o sistema de cores.

### Resultado Visual

| Antes | Depois |
|-------|--------|
| Todos avatares com mesma cor laranja suave | Cada membro com sua cor única (vermelho, azul, verde, etc.) |
| Difícil distinguir membros | Fácil identificação visual |

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/department/LeaderSlotAvailabilityView.tsx` | Adicionar import + useMemo + style no Avatar |
| `src/components/department/LeaderAvailabilityView.tsx` | Adicionar import + useMemo + style no Avatar |
| `src/components/department/SmartScheduleDialog.tsx` | Adicionar import + useMemo + style no Avatar |

### Detalhes Técnicos

O sistema de cores em `memberColors.ts`:
- Membros 1-12: cores sólidas únicas (vermelho, azul, verde, etc.)
- Membros 13+: gradientes bicolores únicos
- Cores são atribuídas baseadas na ordem dos membros no array

Para garantir consistência, todos os componentes devem usar o mesmo array de membros na mesma ordem ao criar o mapa de cores.

