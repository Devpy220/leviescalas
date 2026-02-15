
# Melhorar Formato das Notificacoes com Dia da Semana, Setor e Funcao

## Problema Atual

As notificacoes mostram textos genericos como:
- "Nova escala em Estacionamento para segunda-feira, 5 de maio de 2025"
- "Voce tem escala em 3 dias em Estacionamento as 08:00"

Faltam informacoes importantes: **dia da semana destacado**, **setor** e **funcao** (assignment role).

## Nova Formatacao

Formato proposto para todas as notificacoes:

**Antes:**
> Nova escala em Estacionamento para segunda-feira, 5 de maio de 2025

**Depois:**
> Estacionamento - Domingo, 15/jun as 08:00 | Setor A - Plantao

---

## Mudancas por Arquivo

### 1. `supabase/functions/send-schedule-notification/index.ts`

**Adicionar campos ao schema de entrada:**
- `sector_name` (opcional) - nome do setor
- `assignment_role` (opcional) - funcao na escala (ex: "on_duty", "participant")
- `assignment_role_label` (opcional) - label da funcao (ex: "Plantao", "Culto")

**Atualizar formato de data** de "segunda-feira, 5 de maio de 2025" para "Domingo, 15/jun":
```
formatDate: "Domingo, 15 de junho" (mais curto e legivel)
```

**Atualizar mensagens:**

- **Push**: `"Estacionamento: Domingo, 15/jun as 08:00 | Setor A - Plantao"`
- **In-app**: `"Domingo, 15/jun as 08:00 - Estacionamento | Setor A - Plantao"`
- **Email**: Adicionar linhas de Setor e Funcao no card de informacoes
- **WhatsApp/Telegram**: Adicionar emoji e linhas para setor e funcao
- **Lembretes**: Incluir dia da semana e setor/funcao quando disponiveis

### 2. `supabase/functions/send-scheduled-reminders/index.ts`

**Buscar dados extras do schedule**: Atualmente busca apenas `id, date, time_start, time_end, user_id, department_id`. Passar a buscar tambem `sector_id, assignment_role` e fazer join com `sectors` para pegar o nome.

**Atualizar mensagens dos lembretes:**
- Antes: `"Voce tem escala em 3 dias em Estacionamento as 08:00"`
- Depois: `"Escala em 3 dias: Domingo, 15/jun as 08:00 - Estacionamento | Setor A - Plantao"`

### 3. `src/components/department/SmartScheduleDialog.tsx`

**Atualizar mensagem de notificacao in-app** (linha 243):
- Antes: `"Voce foi escalado para 15/06 (domingo) das 08:00 as 12:00"`
- Depois: `"Domingo, 15/jun as 08:00-12:00 | Setor A - Plantao"`

Buscar nome do setor e label da funcao para incluir na mensagem.

---

## Detalhes Tecnicos

### send-schedule-notification/index.ts

1. Adicionar campos opcionais ao `notificationSchema`:
   - `sector_name: z.string().max(100).optional()`
   - `assignment_role_label: z.string().max(50).optional()`

2. Criar funcao auxiliar `formatShortDate` que retorna "Domingo, 15 de junho" em vez do formato longo atual

3. Construir sufixo condicional:
   ```
   const details = [sector_name, assignment_role_label].filter(Boolean).join(' - ');
   const detailsSuffix = details ? ` | ${details}` : '';
   ```

4. Aplicar em todas as mensagens (push, email HTML, Telegram, in-app)

### send-scheduled-reminders/index.ts

1. Alterar query para incluir `sector:sectors(name), assignment_role`
2. Adicionar mapa de assignment roles (labels) inline
3. Atualizar `bodyFn` para incluir dia da semana, setor e funcao
4. Criar funcao `formatWeekday` para converter date string em dia da semana em portugues

### SmartScheduleDialog.tsx

1. Na criacao de notificacoes (linha 234-246), buscar nome do setor e label da funcao do `scheduleInfo`
2. Formatar mensagem com dia da semana, setor e funcao

### Quem envia os dados extras?

Os componentes que chamam `send-schedule-notification` precisam enviar `sector_name` e `assignment_role_label`. Verificar `AddScheduleDialog.tsx` e `SmartScheduleDialog.tsx` para garantir que esses dados sao passados.
