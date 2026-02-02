
# Visualizar Escalas de Todos com Destaque nas Minhas

## O que será implementado

Adicionar um botão na página "Minhas Escalas" (`/my-schedules`) para alternar entre:
1. **Minhas Escalas** (padrão) - mostra apenas os dias em que você está escalado
2. **Escala da Equipe** - mostra todas as escalas do departamento, com destaque nos seus dias colocarem destaque um fundo verde a pessoa que esta logado

---

## Interface proposta

```text
┌─────────────────────────────────────────────────┐
│  ← Minhas Escalas                   🌙 🔔       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  [👤 Minhas Escalas]  [👥 Escala da Equipe]  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Próximas Escalas                               │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │DOM 02/02 │  │QUA 05/02 │  │DOM 09/02 │      │
│  │ 08:00    │  │ 19:30    │  │ 08:00    │      │
│  │ VOCÊ  ⭐ │  │ João     │  │ VOCÊ  ⭐ │      │
│  │ Maria    │  │ Pedro    │  │ Carlos   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Comportamento do toggle

| Modo | Exibe | Destaque |
|------|-------|----------|
| **Minhas Escalas** | Apenas escalas onde `user_id = meu_id` | Cards normais |
| **Escala da Equipe** | Todas as escalas do departamento | Cards com borda especial + ícone ⭐ quando você está escalado |

---

## Mudanças técnicas

### 1. Adicionar estado para controlar o modo de visualização

```typescript
const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');
```

### 2. Modificar a query de escalas

**Modo "Minhas Escalas"** (já existe):
```typescript
.eq('user_id', user.id)
```

**Modo "Escala da Equipe"** (novo):
```typescript
// Remove o filtro de user_id para trazer todas as escalas do departamento
// A RLS já permite: "Members can view department schedules"
```

### 3. Buscar nomes dos voluntários

No modo "Escala da Equipe", precisamos também mostrar quem está escalado em cada dia. Usaremos a mesma função segura que o departamento usa:
```typescript
// get_department_member_profiles já existe e retorna nomes
```

### 4. Interface de toggle

Usar `Tabs` ou botões com estilo segmentado para alternar entre os modos:

```tsx
<div className="flex bg-muted rounded-lg p-1 gap-1">
  <Button
    size="sm"
    variant={viewMode === 'mine' ? 'default' : 'ghost'}
    onClick={() => setViewMode('mine')}
  >
    <User className="w-4 h-4 mr-1" />
    Minhas Escalas
  </Button>
  <Button
    size="sm"
    variant={viewMode === 'team' ? 'default' : 'ghost'}
    onClick={() => setViewMode('team')}
  >
    <Users className="w-4 h-4 mr-1" />
    Escala da Equipe
  </Button>
</div>
```

### 5. Card com destaque visual

Quando estiver no modo "Escala da Equipe" e o usuário estiver escalado naquele dia:

```tsx
<Card className={cn(
  "relative overflow-hidden flex flex-col",
  isMySchedule && "ring-2 ring-primary border-primary/50"
)}>
  {isMySchedule && (
    <Badge className="absolute top-2 right-2 bg-primary text-white text-xs">
      ⭐ Você
    </Badge>
  )}
  ...
</Card>
```

---

## Arquivo a ser modificado

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/MySchedules.tsx` | Adicionar toggle de visualização, nova query para buscar todas escalas, lógica de destaque nos cards |

---

## Segurança (já garantida)

A RLS do banco já permite que membros vejam as escalas do departamento:
- Política: "Members can view department schedules" - `is_department_member(auth.uid(), department_id)`

Isso significa que a query já funcionará sem erros de permissão.

---

## Resultado esperado

1. Usuário abre "Minhas Escalas" → vê apenas seus dias (comportamento atual)
2. Clica em "Escala da Equipe" → vê todas as escalas do departamento
3. Seus dias aparecem com destaque visual (borda colorida + badge "⭐ Você")
4. Pode facilmente identificar quando está escalado junto com outros colegas
