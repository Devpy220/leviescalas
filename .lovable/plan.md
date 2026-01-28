

## Plano: Cores Bicolores para Membros Extras (13+)

### Problema Atual

Quando um departamento tem mais de 12 membros, as cores começam a se repetir:
- Membro 1: Vermelho
- Membro 13: Vermelho ← **Conflito!**

### Solução Proposta

Criar **combinações de duas cores** para membros além do 12º, gerando identificações visuais únicas:

```text
Membros 1-12:  Cor sólida (paleta atual)
┌──────────────────────────────────┐
│  1. Vermelho    ████████████     │
│  2. Azul Royal  ████████████     │
│  ...                             │
│ 12. Índigo      ████████████     │
└──────────────────────────────────┘

Membros 13+: Combinação de duas cores (gradiente diagonal)
┌──────────────────────────────────┐
│ 13. Vermelho + Azul     ████████ │ (gradiente)
│ 14. Vermelho + Verde    ████████ │
│ 15. Vermelho + Laranja  ████████ │
│ ...                              │
│ 24. Azul + Verde        ████████ │
│ ...                              │
└──────────────────────────────────┘
```

### Implementação Técnica

#### 1. Atualizar `src/lib/memberColors.ts`

Adicionar função para gerar combinações bicolores:

```text
Lógica de combinação:
- 12 cores primárias = 12 membros sólidos
- Combinações de 2: C(12,2) = 66 combinações possíveis
- Total: 12 + 66 = 78 membros com cores únicas!
```

Nova interface para suportar cores duplas:
```typescript
interface MemberColorResult {
  primary: string;       // Cor principal
  secondary?: string;    // Segunda cor (se aplicável)
  isGradient: boolean;   // Se deve renderizar como gradiente
}
```

#### 2. Atualizar componentes visuais

Os avatares e indicadores precisarão suportar gradientes CSS:

```css
/* Cor sólida (membros 1-12) */
background: #EF4444;

/* Gradiente diagonal (membros 13+) */
background: linear-gradient(135deg, #EF4444 50%, #2563EB 50%);
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/memberColors.ts` | Adicionar lógica de combinações bicolores |
| `src/components/department/MemberList.tsx` | Renderizar gradientes para membros 13+ |
| `src/components/department/ScheduleCalendar.tsx` | Suportar gradientes nos indicadores de escala |
| `src/components/department/ScheduleTable.tsx` | Suportar gradientes na tabela de escalas |

### Exemplos Visuais

**Avatar com cor sólida (membros 1-12):**
```text
┌─────────┐
│   JP    │  ← Fundo vermelho sólido
└─────────┘
```

**Avatar com gradiente (membros 13+):**
```text
┌─────────┐
│   CS    │  ← Metade vermelho, metade azul (diagonal)
└─────────┘
```

### Detalhes da Lógica

Para membro com índice >= 12:
1. Calcular qual par de cores usar
2. Par 0 = cores 0+1 (Vermelho + Azul)
3. Par 1 = cores 0+2 (Vermelho + Verde)
4. E assim por diante...

```text
Membro 13 → Par 0 → Vermelho + Azul Royal
Membro 14 → Par 1 → Vermelho + Verde
Membro 15 → Par 2 → Vermelho + Laranja
...
Membro 24 → Par 11 → Azul Royal + Verde
```

### Benefícios

- Suporte para até 78 membros com cores únicas
- Identificação visual clara mesmo em departamentos grandes
- Gradientes são visualmente atraentes e distintos
- Mantém compatibilidade com o sistema atual (primeiros 12 membros não mudam)

