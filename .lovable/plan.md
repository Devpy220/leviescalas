
# Plano: Simplificar Navegação entre Escalas e Disponibilidade

## Objetivo
Adicionar botões de ação rápida na página "Minhas Escalas" (`/my-schedules`) para:
1. **Todos os usuários**: Acesso direto à "Minha Disponibilidade"
2. **Líderes**: Acesso direto para criar escalas (manual ou IA)

---

## Mudanças Propostas

### 1. Modificar `src/pages/MySchedules.tsx`

**Adicionar imports necessários:**
- `Clock` e `Sparkles` do lucide-react (já existem alguns)
- `CalendarPlus` para o botão de criar escala manual

**Adicionar estado e lógica:**
- Buscar se o usuário é líder em algum departamento
- Criar states para controlar sheets/dialogs de disponibilidade

**Adicionar barra de ações no header ou abaixo do toggle de view:**
```
┌─────────────────────────────────────────────────────────┐
│  [Toggle: Minhas Escalas | Escala da Equipe]            │
│                                                         │
│  [🕐 Minha Disponibilidade]  [✨ Criar Escala]*        │
│                               * só para líderes         │
└─────────────────────────────────────────────────────────┘
```

**Implementar navegação:**
- "Minha Disponibilidade" → Abre um Sheet com SlotAvailability + MemberPreferences
- "Criar Escala" (líder) → Redireciona para o departamento com dialog de criação aberto

---

### 2. Criar componente de disponibilidade reutilizável

Reaproveitar o `MyAvailabilitySheet.tsx` existente, passando o departmentId do primeiro departamento do usuário.

---

### 3. Fluxo para Líderes - Criar Escalas

Como o usuário pode ter múltiplos departamentos, o botão "Criar Escala" terá duas opções:
- Se tem **1 departamento**: redireciona direto para `/departments/{id}?action=add-schedule`
- Se tem **múltiplos departamentos**: mostra dropdown para escolher qual departamento

---

## Detalhes Técnicos

### Arquivos a modificar:
1. **`src/pages/MySchedules.tsx`**:
   - Adicionar query para verificar se usuário é líder
   - Adicionar barra de ações com botões
   - Integrar `MyAvailabilitySheet` para disponibilidade

### Componentes reutilizados:
- `MyAvailabilitySheet` - já existe e funciona
- `SlotAvailability` e `MemberPreferences` - componentes de disponibilidade

### Fluxo simplificado:
```
MySchedules
    ├── Botão "Minha Disponibilidade" → Abre Sheet
    │       └── SlotAvailability + MemberPreferences
    │
    └── Botão "Criar Escala" (só líder)
            ├── 1 dept → Redireciona /departments/{id}?action=add-schedule
            └── N depts → Dropdown para escolher departamento
```

---

## Benefícios

1. **Centralização**: Usuário não precisa voltar ao departamento para acessar disponibilidade
2. **Menos cliques**: Ações importantes acessíveis diretamente
3. **Consistência**: Mantém o mesmo padrão visual do restante do app
4. **Simplicidade**: Remove necessidade de navegar entre páginas para tarefas comuns
