

## Plano: Otimizar Paleta de Cores dos Membros

### Problema Identificado

A paleta atual de 16 cores tem várias cores de tons similares que podem causar confusão visual:

| Grupo Problemático | Cores Atuais |
|-------------------|--------------|
| **Roxos** | Roxo (#A855F7), Púrpura (#6B21A8), Violeta (#7C3AED) |
| **Rosas** | Rosa (#EC4899), Magenta (#BE185D) |
| **Verdes** | Verde (#22C55E), Verde Escuro (#065F46), Lima (#84CC16) |
| **Azuis** | Azul (#3B82F6), Azul Marinho (#1E3A5F), Ciano (#06B6D4), Turquesa (#14B8A6) |

Além disso, existe uma **inconsistência**: o arquivo `MemberList.tsx` usa uma paleta local diferente (10 cores) em vez de importar do `memberColors.ts`.

### Solução Proposta

Criar uma nova paleta com **12 cores totalmente distintas**, otimizadas para máxima diferenciação visual:

```text
Nova Paleta (12 cores distintas):
┌─────────────────────────────────────────────────────────┐
│  1. Vermelho       #EF4444  ████████                    │
│  2. Azul Royal     #2563EB  ████████                    │
│  3. Verde          #16A34A  ████████                    │
│  4. Laranja        #EA580C  ████████                    │
│  5. Roxo           #9333EA  ████████                    │
│  6. Amarelo        #CA8A04  ████████  (dourado)         │
│  7. Rosa           #DB2777  ████████                    │
│  8. Turquesa       #0D9488  ████████                    │
│  9. Marrom         #92400E  ████████                    │
│ 10. Azul Marinho   #1E40AF  ████████                    │
│ 11. Coral          #F97316  ████████                    │
│ 12. Índigo         #4F46E5  ████████                    │
└─────────────────────────────────────────────────────────┘
```

**Critérios da nova paleta:**
- Nenhuma cor com variações claras/escuras do mesmo tom
- Cada cor é visualmente distinta das outras 11
- Funciona bem em modo claro e escuro
- 12 cores cobrem a maioria dos departamentos

### Alterações Necessárias

#### 1. Atualizar `src/lib/memberColors.ts`

Substituir a paleta atual por 12 cores altamente distintas, removendo variações similares:

**Cores removidas:**
- Púrpura, Violeta (similares ao Roxo)
- Magenta (similar ao Rosa)
- Verde Escuro, Lima (similares ao Verde)
- Ciano (similar ao Turquesa)

**Cores mantidas/ajustadas:**
- Vermelho, Verde, Laranja, Roxo, Rosa, Turquesa, Marrom, Azul Marinho
- Azul ajustado para tom mais distinto
- Amarelo ajustado para dourado (melhor contraste)
- Adicionado Coral e Índigo para diversidade

#### 2. Atualizar `src/components/department/MemberList.tsx`

Remover a paleta local duplicada e importar do `memberColors.ts` para manter consistência em toda a aplicação.

### Detalhes Técnicos

**Arquivo: `src/lib/memberColors.ts`**
- Reduzir de 16 para 12 cores
- Cada cor terá hex único sem variações de tom
- Manter a estrutura atual com `bg`, `dot`, `text`, `border`, `name`

**Arquivo: `src/components/department/MemberList.tsx`**
- Remover constante local `memberColors`
- Importar `createMemberColorMap` e `getMemberHexColor` do `memberColors.ts`
- Usar `useMemo` para criar o mapa de cores uma vez

### Impacto Visual

Antes (confusão possível):
```text
Membro 1: Roxo     ████
Membro 2: Violeta  ████  ← Muito parecido!
Membro 3: Verde    ████
Membro 4: Lima     ████  ← Muito parecido!
```

Depois (distinção clara):
```text
Membro 1: Roxo     ████
Membro 2: Rosa     ████  ← Claramente diferente
Membro 3: Verde    ████
Membro 4: Laranja  ████  ← Claramente diferente
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/memberColors.ts` | Nova paleta de 12 cores distintas |
| `src/components/department/MemberList.tsx` | Usar paleta centralizada |

### Benefícios

- Eliminação de confusão visual entre membros
- Consistência de cores em toda a aplicação
- Paleta otimizada para acessibilidade visual
- Código mais limpo sem duplicação

