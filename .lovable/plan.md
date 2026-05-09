## Comando "escala" no WhatsApp

Quando um voluntário enviar a palavra **escala** (sozinha, sem aspas) para o WhatsApp do LEVI, o sistema responde automaticamente com a lista de todas as escalas futuras dele, identificando o usuário pelo número de WhatsApp.

### Como funciona

1. Voluntário envia `escala` no WhatsApp do LEVI.
2. LEVI identifica o usuário pelo número (últimos 10 dígitos), igual ao fluxo de "troca".
3. LEVI busca todas as escalas futuras (data ≥ hoje) do usuário em todos os departamentos em que ele participa.
4. LEVI envia uma mensagem formatada agrupada por departamento, com data, dia da semana, horário e função (se houver).

### Exemplo de resposta

```
📅 Olá Lucas! Suas próximas escalas:
━━━━━━━━━━━━━━━━━━━━

🎵 *Louvor*
• 12/05 (Dom) 18:00–22:00
• 19/05 (Dom) 08:00–12:00 — Vocal
• 02/06 (Dom) 18:00–22:00

🅿️ *Estacionamento*
• 25/05 (Dom) 08:00–12:00

━━━━━━━━━━━━━━━━━━━━
Para trocar uma escala, envie *troca*.

_LEVI_
```

Se não houver escalas futuras: `📭 Você não tem escalas futuras agendadas no momento.`

### Detalhes técnicos

**Arquivo modificado:** `supabase/functions/zapi-webhook-receive/index.ts`

- Adicionar um novo roteador no topo (antes do `tryHandleSwapMessage`) que detecta texto `escala` (case-insensitive, trim, sozinho) e chama um novo helper `handleScheduleListMessage`.
- O helper:
  - Busca `members` do usuário → IDs de departamentos.
  - Busca `schedules` onde `user_id = profile.id` AND `date >= today`, ordenado por `date, time_start`, com join no nome do departamento.
  - Formata mensagem agrupada por departamento (PT-BR, dia da semana abreviado).
  - Envia via `send-whatsapp-notification` (mesmo padrão já usado).
- Não persiste estado (não usa `whatsapp_swap_sessions`); é uma resposta única.
- Mantém compatibilidade total com fluxos existentes (`troca`, blackout collection).

### Fora de escopo

- Sem alterações de UI no app.
- Sem novas tabelas ou migrações.
- Sem alteração no comportamento de "troca" ou na coleta de blackouts.