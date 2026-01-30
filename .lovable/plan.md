

# Plano: Visualização das Escalas do Líder

## Problema Identificado
O líder do departamento não tem uma forma clara de visualizar suas próprias escalas quando está na página do departamento. Atualmente ele precisa voltar ao Dashboard e acessar "Minhas Escalas" separadamente.

## Opções de Solução

### Opção A: Adicionar link no menu de ações (Recomendada)
Adicionar um botão "Minhas Escalas" no menu hamburger do líder que navega para `/my-schedules`.

### Opção B: Adicionar seção na Sheet de Disponibilidade
Expandir a Sheet "Minha Disponibilidade" para incluir uma lista das escalas do líder.

## Implementação Proposta (Opção A)

### Mudanças no ActionMenuContent
Adicionar um novo item de ação que navega para a página "Minhas Escalas":

```text
┌─────────────────────────────────┐
│  Menu de Ações do Líder         │
├─────────────────────────────────┤
│  [📅 Escalas] [📦 Setores] [👥]│
├─────────────────────────────────┤
│  [📥 Exportar] [⏰ Dispon.]     │
│  [👤+ Convidar] [📋 Minhas]    │  ← NOVO
└─────────────────────────────────┘
```

### Arquivo a ser modificado
`src/components/department/ActionMenuContent.tsx`

### Código
Adicionar novo item de ação:
```typescript
const actionItems = [
  // ... existentes
  { 
    id: 'my-schedules',
    icon: CalendarDays, // ou CalendarCheck
    label: 'Minhas Escalas', 
    color: 'text-pink-500 hover:text-pink-400 hover:bg-pink-500/10',
  },
];
```

E adicionar handler que navega para `/my-schedules`:
```typescript
case 'my-schedules':
  window.location.href = '/my-schedules';
  onClose();
  break;
```

### Benefícios
1. **Acesso rápido**: Líder pode ver suas escalas sem sair do contexto do departamento
2. **Consistência**: Usa a mesma página que os membros regulares
3. **Simplicidade**: Mudança mínima no código

---

## Arquivos Impactados
| Arquivo | Mudança |
|---------|---------|
| `src/components/department/ActionMenuContent.tsx` | Adicionar botão "Minhas Escalas" no menu de ações |
| `src/components/department/ActionMenuPopover.tsx` | Passar handler de navegação para "Minhas Escalas" |

