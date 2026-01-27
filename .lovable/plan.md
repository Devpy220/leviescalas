
## Plano: Zerar Disponibilidade Semanal na Segunda Quinzena

### Contexto Atual

A tabela `member_availability` armazena a disponibilidade semanal (ex: "Domingo Manhã", "Quarta") **sem período definido** - ou seja, uma vez marcado, fica permanente. Você quer que essas disponibilidades sejam **zeradas automaticamente no dia 16 de cada mês**, obrigando os membros a remarcar para a próxima quinzena.

### Solução Proposta

Criar um sistema que:
1. Adiciona uma coluna de período à tabela (para saber qual quinzena a disponibilidade pertence)
2. Cria um job automático que "zera" as disponibilidades no dia 16
3. Atualiza a interface para mostrar que a disponibilidade vale até o próximo reset

---

### Mudanças no Banco de Dados

**Nova coluna em `member_availability`:**

```sql
ALTER TABLE public.member_availability
ADD COLUMN period_start date NOT NULL DEFAULT (
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 16 
    THEN DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '15 days'
    ELSE DATE_TRUNC('month', CURRENT_DATE)
  END
);
```

Isso marca automaticamente em qual período (1-15 ou 16-31) a disponibilidade foi criada.

---

### Nova Edge Function: `reset-availability`

Cria uma função que:
- Deleta todos os registros de `member_availability` cujo `period_start` é anterior ao período atual
- Pode ser chamada manualmente pelo admin ou por um cron job

```typescript
// supabase/functions/reset-availability/index.ts
// Lógica:
// 1. Calcula o período atual (dia 1-15 ou 16-fim)
// 2. Deleta registros com period_start anterior
// 3. Retorna quantidade de registros removidos
```

---

### Configuração de Cron Job

Adicionar ao `supabase/config.toml`:

```toml
[functions.reset-availability]
schedule = "0 0 16 * *"  # Executa às 00:00 do dia 16 de cada mês
```

---

### Mudanças no Frontend

**Arquivo: `src/components/department/SlotAvailability.tsx`**

1. Adicionar indicador visual mostrando até quando a disponibilidade é válida:

```text
┌────────────────────────────────────────┐
│ Disponibilidade Semanal                │
│ ⚠️ Válida até 31/Janeiro               │
│ Após essa data, você precisará remarcar│
│                                        │
│ [x] Domingo Manhã                      │
│ [x] Domingo Noite                      │
│ [ ] Segunda                            │
│ [x] Quarta                             │
│ [ ] Sexta                              │
└────────────────────────────────────────┘
```

2. Ao buscar disponibilidades, filtrar apenas pelo período atual
3. Ao salvar, incluir o `period_start` correto

---

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx.sql` | Adicionar coluna `period_start` |
| `supabase/functions/reset-availability/index.ts` | **Criar** - função para zerar disponibilidades |
| `supabase/config.toml` | Configurar cron job (dia 16) |
| `src/components/department/SlotAvailability.tsx` | Filtrar por período + mostrar validade |
| `src/integrations/supabase/types.ts` | Será atualizado automaticamente |

---

### Fluxo do Reset

```text
Dia 16 do mês (00:00)
        │
        ▼
┌───────────────────┐
│ Cron executa      │
│ reset-availability│
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────────────┐
│ DELETE FROM member_availability   │
│ WHERE period_start < período_atual│
└─────────┬─────────────────────────┘
          │
          ▼
┌───────────────────────────────────┐
│ Membros veem slots vazios         │
│ e precisam remarcar               │
└───────────────────────────────────┘
```

---

### Considerações

- **Registros existentes**: O migration definirá `period_start` para todos os registros atuais como o período atual
- **Notificação**: Opcionalmente, podemos notificar os membros quando o reset acontecer
- **Período**: Cada mês tem 2 períodos: dias 1-15 (primeira quinzena) e 16-fim (segunda quinzena)

---

### Resumo da Implementação

1. Adicionar coluna `period_start` na tabela
2. Criar edge function `reset-availability`
3. Configurar cron job para dia 16
4. Atualizar UI para mostrar validade e filtrar por período
