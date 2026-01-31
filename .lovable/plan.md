

# Plano: Botão "Escalar Todos" e Layout em Grade nas Escalas

## Resumo das Mudanças

Duas melhorias na experiência do líder e dos membros:

1. **Botão "Escalar Todos"** - Na criação de escalas, após escolher data e horário, adicionar um botão que escala automaticamente **todos os membros disponíveis** com um único clique (já existe como "Selecionar Todos" mas será mais proeminente)

2. **Layout Lado a Lado** - Na página "Minhas Escalas", trocar o layout de lista vertical para uma **grade horizontal** com as escalas uma ao lado da outra, igual ao UnifiedScheduleView

---

## Mudança 1: Botão "Escalar Todos" mais Proeminente

### Situação Atual
O `AddScheduleDialog` já possui um botão "Todos" pequeno, mas não é muito visível.

### Nova Interface

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📅 Data: Domingo, 02 de Fevereiro                                  │
│  ⏰ Horário: Noite (18:00 - 22:00)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │      [👥 ESCALAR TODOS OS MEMBROS]                          │   │  ← BOTÃO GRANDE NOVO
│  │      Escala 8 membros disponíveis de uma vez                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ── ou selecione individualmente ──                                 │
│                                                                     │
│  ☑ João Silva              ☐ Maria Santos                          │
│  ☐ Pedro Costa             ☑ Ana Lima                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementação

Adicionar um botão destacado antes da lista de membros que:
- Seleciona automaticamente todos os membros não-bloqueados
- Avança direto para o passo de configuração
- Exibe quantidade de membros que serão escalados

---

## Mudança 2: Layout em Grade na Página "Minhas Escalas"

### Situação Atual
As escalas são exibidas em **lista vertical** (uma embaixo da outra).

### Novo Layout

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│  Próximas Escalas                                                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │ DOM 02/02           │  │ QUA 05/02           │  │ DOM 09/02           │   │
│  │ 18:00 - 22:00       │  │ 19:30 - 22:00       │  │ 08:00 - 12:00       │   │
│  │                     │  │                     │  │                     │   │
│  │ Estacionamento 🚗   │  │ Recepção ✅         │  │ Som                 │   │
│  │                     │  │                     │  │                     │   │
│  │ [🔄 Pedir Troca]    │  │ [🔄 Pedir Troca]    │  │ [🔄 Pedir Troca]    │   │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   │
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐                            │
│  │ QUA 12/02           │  │ DOM 16/02           │                            │
│  │ 19:30 - 22:00       │  │ 18:00 - 22:00       │                            │
│  └─────────────────────┘  └─────────────────────┘                            │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Implementação

Alterar o grid de `grid gap-3` (lista vertical) para `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` (grade responsiva):
- 1 coluna em telas pequenas
- 2 colunas em tablets
- 3 colunas em desktop

Redesenhar cada card de escala para ser mais compacto e adequado à visualização em grade.

---

## Detalhes Técnicos

### Arquivo 1: `src/components/department/AddScheduleDialog.tsx`

**Mudanças:**
- Adicionar botão destacado "Escalar Todos" logo abaixo da seleção de horário
- O botão mostra quantos membros serão escalados
- Ao clicar, seleciona todos os membros disponíveis e avança para configuração

**Novo código (após seleção de horário):**
```typescript
{/* Quick Schedule All Button */}
<div className="pt-2 border-t">
  <Button
    type="button"
    className="w-full gap-2"
    variant="default"
    onClick={() => {
      selectAllAvailable();
      setStep('configure');
    }}
    disabled={availableMembers.length === 0}
  >
    <Users className="w-4 h-4" />
    Escalar Todos ({availableMembers.length} membros)
  </Button>
  <p className="text-xs text-muted-foreground text-center mt-2">
    ou selecione individualmente abaixo
  </p>
</div>
```

### Arquivo 2: `src/pages/MySchedules.tsx`

**Mudanças:**
- Alterar o grid para layout responsivo horizontal
- Redesenhar cards para formato mais compacto
- Manter funcionalidade de troca integrada

**Novo layout:**
```typescript
// De: <div className="grid gap-3">
// Para:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {schedules.map((schedule) => (
    <ScheduleCard key={schedule.id} schedule={schedule} ... />
  ))}
</div>
```

**Novo card (compacto para grade):**
- Header colorido com dia da semana
- Data e horário
- Setor e departamento
- Botão de troca na parte inferior

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/department/AddScheduleDialog.tsx` | Adicionar botão "Escalar Todos" destacado |
| `src/pages/MySchedules.tsx` | Alterar para layout em grade responsiva |

---

## Benefícios

1. **Velocidade para líderes** - Escalar todos de uma vez com um clique
2. **Melhor visualização** - Ver todas as escalas lado a lado sem scroll excessivo
3. **Consistência** - Layout similar ao UnifiedScheduleView do departamento
4. **Responsividade** - Funciona bem em desktop e mobile

