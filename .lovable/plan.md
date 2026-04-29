
# Troca de Escala via WhatsApp

Permitir que o voluntário inicie e conclua uma solicitação de troca de escala diretamente pelo WhatsApp do LEVI, usando uma conversa simples guiada por menus numerados.

## Fluxo do usuário

1. **Voluntário envia "troca"** no WhatsApp do LEVI.
2. **LEVI responde** com a lista das próximas escalas dele (até 5), numeradas:
   ```
   Olá Lucas! Qual escala você quer trocar?
   1) 12/05 (Dom) 18:00-22:00 - Louvor
   2) 19/05 (Dom) 08:00-12:00 - Louvor
   3) 02/06 (Dom) 18:00-22:00 - Louvor
   Responda com o número.
   ```
3. **Voluntário responde "1"** → LEVI mostra os colegas elegíveis para trocar (do mesmo departamento, que **não estão bloqueados** naquele dia e que possuem outra escala futura no mesmo dept para servir de contrapartida), numerados:
   ```
   Com quem você quer trocar a escala de 12/05?
   1) Maria Silva - escala em 19/05 18:00-22:00
   2) João Costa - escala em 26/05 08:00-12:00
   3) Ana Souza - escala em 02/06 18:00-22:00
   Responda com o número (ou "cancelar").
   ```
4. **Voluntário responde "1"** → LEVI cria registro `pending` em `schedule_swaps` e dispara WhatsApp para a Maria:
   ```
   Oi Maria! Lucas pediu para trocar de escala com você:
   • Você assume: 12/05 (Dom) 18:00-22:00
   • Lucas assume sua: 19/05 (Dom) 18:00-22:00
   Responde "sim" para aceitar ou "não" para recusar.
   ```
5. **Maria responde "sim"** → executa `execute_schedule_swap`, notifica Lucas ("✅ Maria aceitou! Escalas trocadas.") e Maria ("✅ Troca concluída.").
6. **Maria responde "não"** → LEVI volta para Lucas com até 3 alternativas restantes:
   ```
   Maria não pôde trocar. Quer tentar com outra pessoa?
   1) João Costa - 26/05
   2) Ana Souza - 02/06
   3) Pedro Lima - 09/06
   Responda com o número, ou "falar com líder" para encerrar.
   ```
   Após 3 recusas (ou se não houver mais opções), LEVI encerra:
   `❌ Não foi possível encontrar substituto. Por favor fale com seu líder.` e notifica o líder do departamento por WhatsApp.

## Componentes técnicos

### 1. Nova tabela `whatsapp_swap_sessions`
Armazena estado da conversa por usuário (não há sessões persistentes hoje no `zapi-webhook-receive`):
- `id`, `user_id`, `phone`
- `state` (enum texto): `awaiting_schedule_pick` | `awaiting_target_pick` | `awaiting_response` | `done` | `cancelled`
- `requester_schedule_id` (nullable)
- `candidate_target_user_ids` (uuid[]) — pool de candidatos restantes
- `current_target_user_id` (nullable) — quem está sendo perguntado agora (para o lado da Maria)
- `attempts_count` (int, default 0) — número de recusas já tentadas (limite 3)
- `swap_id` (nullable) — referência para `schedule_swaps`
- `expires_at` (timestamptz, +30min)
- `created_at`, `updated_at`
- RLS: service role only.

### 2. Edge function `zapi-webhook-receive` (modificar)

Atual lógica processa apenas blackout collection. Adicionar **roteador no topo**:

- Se texto começa com `"troca"` (case-insensitive, sozinho) → entra no fluxo de **iniciador**.
- Se existe `whatsapp_swap_sessions` ativa para o telefone com `state='awaiting_schedule_pick'` → interpreta como número de escala.
- Idem para `awaiting_target_pick` (número do colega ou "cancelar"/"falar com líder").
- Se existe sessão `awaiting_response` onde `current_target_user_id = profile.id` → interpreta `sim`/`não`.
- Caso contrário, cai no fluxo atual de blackout (mantém compatibilidade).

Helpers internos:
- `getMemberFutureSchedules(userId, deptIds)` — escalas próximas (data ≥ hoje), limit 5.
- `getEligibleSwapCandidates(scheduleId, deptId)` — colegas do mesmo dept que:
  - **NÃO** têm a data da escala-alvo em `member_preferences.blackout_dates` (do dept correspondente);
  - **NÃO** já estão escalados nesse mesmo dia/horário no dept;
  - Possuem **pelo menos uma escala futura** no mesmo dept (para servir de contrapartida da troca);
  - Ordenados por proximidade de data dessa contrapartida.
- `sendWhatsapp(phone, message)` — usa a função existente `send-whatsapp-notification`.
- `notifyLeaderFallback(deptId, requesterName, dateStr)` — quando atingir 3 recusas.

### 3. Reaproveitar lógica existente
- `execute_schedule_swap(swap_id)` — função SQL já existe, será chamada quando o alvo responder "sim".
- `schedule_swaps` table — registros criados com `status='pending'` e atualizados para `accepted`/`rejected`.
- Notificações in-app criadas em `notifications` (espelham as notificações do fluxo atual via `useScheduleSwaps`).

### 4. Casos de borda
- Voluntário não está em nenhum dept → "Você não tem escalas ativas."
- Sem escalas futuras → "Você não tem escalas futuras para trocar."
- Sem candidatos elegíveis → "Nenhum colega disponível para trocar nessa data. Fale com seu líder." (notifica líder).
- Resposta inválida (texto fora do menu) → "Não entendi. Responda com um número, ou 'cancelar'."
- Sessão expirada (>30min) → ignorada; ao receber novo "troca" inicia nova sessão.
- Apenas **uma sessão ativa por usuário**: ao receber novo "troca", encerra a anterior.

## Estrutura de arquivos

```
supabase/functions/zapi-webhook-receive/
├── index.ts                  (modificado — roteador adicionado no topo)
├── swapFlow.ts               (NOVO — lógica completa do fluxo de troca)
└── ../_shared/swapHelpers.ts (NOVO — queries de candidatos e formatação)
```

Migração SQL para criar `whatsapp_swap_sessions` (RLS service role only).

## Pontos fora de escopo
- UI no app não muda — o fluxo via WhatsApp é adicional ao `SwapRequestDialog` existente.
- Sem botões interativos do WhatsApp (Z-API básico) — usamos apenas texto numerado.
