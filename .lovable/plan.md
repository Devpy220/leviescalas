

## Plano Concluído: WhatsApp como Canal Único + Notificações HTML via Link

✅ Todas as tarefas foram implementadas.

### Resumo do que foi feito:
1. Coluna `metadata` (jsonb) adicionada à tabela `notifications`
2. Edge function `view-notification` criada — serve cards HTML premium dark
3. Edge functions simplificadas: `send-schedule-notification`, `send-scheduled-reminders`, `send-announcement-notification`, `send-admin-broadcast` — apenas WhatsApp + link para card
4. Removidos: `PushNotificationToggle`, `TelegramLinkToggle`, `usePushNotifications`
5. `Security.tsx` limpo (sem Push/Telegram cards)
6. `PWAAutoInstaller.tsx` limpo (sem push)
7. `Auth.tsx` atualizado (texto menciona apenas WhatsApp)
