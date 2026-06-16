## Objetivo

Mudar quando os lembretes do WhatsApp são enviados, conforme o turno da escala:


| Turno | Critério (horário de início) | Lembretes       |
| ----- | ---------------------------- | --------------- |
| Manhã | antes de 12:00               | 15h e 10h antes |
| Tarde | entre 12:00 e 17:59          | 7h e 3h antes   |
| Noite | a partir de 18:00            | 10h e 6h antes  |


## Arquivo afetado

`supabase/functions/send-scheduled-reminders/index.ts`

## Mudanças

1. **Substituir** o array `REMINDER_WINDOWS` (hoje só `18h` e `6h` aplicado a tudo) por uma lista que inclui o turno alvo:
  ```ts
   const REMINDER_WINDOWS = [
     // Manhã: 15h e 10h antes
     { type: '15h_morning', hoursAhead: 15, shift: 'morning' },
     { type: '10h_morning', hoursAhead: 10, shift: 'morning' },
     // Tarde: 18h e 6h antes (padrão)
     { type: '18h_afternoon', hoursAhead: 18, shift: 'afternoon' },
     { type: '6h_afternoon',  hoursAhead: 6,  shift: 'afternoon' },
     // Noite: 10h e 6h antes
     { type: '10h_evening', hoursAhead: 10, shift: 'evening' },
     { type: '6h_evening',  hoursAhead: 6,  shift: 'evening' },
   ];
  ```
2. **Filtrar `matchingSchedules**` dentro do loop pelo turno do `time_start`:
  - `morning` → `hour < 12`
  - `afternoon` → `12 ≤ hour < 18`
  - `evening` → `hour ≥ 18`
3. **Idempotência preservada**: `schedule_reminders_sent.reminder_type` continua sendo `window.type`. Como os tipos novos (`15h_morning`, `10h_evening` etc.) são distintos dos antigos (`18h`, `6h`), escalas já notificadas pelo modelo antigo não serão reenviadas — a checagem `.eq('reminder_type', window.type)` cuida disso naturalmente.
4. **Sem mudança** no formato da mensagem, no enfileiramento (`whatsapp_queue` com `forceQueue: true`), nem no cron — só a regra de quando cada escala entra em cada janela.
5. **Redeploy** da função `send-scheduled-reminders`.

## O que não muda

- Cron continua rodando como hoje.
- Layout/conteúdo da mensagem do WhatsApp.
- Lógica de `slot_notes`, swaps, notificações in-app.
- Outras funções (`send-blackout-collection-prompt`, etc.).