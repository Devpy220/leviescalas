

## Plano: WhatsApp como Canal Unico + Notificacoes HTML via Link

### Objetivo
1. Remover todos os canais de notificacao exceto WhatsApp (PushAlert, Telegram, Email/Resend)
2. Criar edge function que serve cards HTML bonitos acessiveis por link
3. Enviar link do card via WhatsApp em vez de texto formatado

---

### 1. Nova Edge Function: `view-notification`

Criar `supabase/functions/view-notification/index.ts` que:
- Recebe um `notification_id` via query param
- Busca dados da notificacao no banco (tabela `notifications` + joins com `schedules`, `departments`, `profiles`)
- Retorna uma pagina HTML completa com o design "Premium Dark Card" (exatamente o modelo fornecido pelo usuario)
- Diferentes templates para cada tipo: `new_schedule`, `schedule_moved`, `announcement`, `schedule_reminder`, `admin_broadcast`
- Inclui botoes de confirmacao/recusa para escalas com token

**Adicionar ao config.toml:**
```toml
[functions.view-notification]
verify_jwt = false
```

---

### 2. Migracao de Banco

Adicionar coluna `metadata` (jsonb) na tabela `notifications` para armazenar dados extras necessarios para renderizar o card (date, time_start, time_end, sector_name, role_label, confirmation_token, etc). Isso evita joins complexos na edge function.

```sql
ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}';
```

---

### 3. Simplificar Edge Functions (remover Push, Telegram, Email)

**`send-schedule-notification`:**
- Remover: `sendPushNotification()`, `sendTelegramNotification()`, fetch para Resend, `RESEND_API_KEY`
- Manter: Validacao, auth, criacao de `notifications` (agora com `metadata` preenchido)
- Alterar: WhatsApp envia link `leviescalas.com.br/n/{notification_id}` em vez de texto longo
- Inserir metadata com date, time, sector, role, confirmation_token no registro da notificacao

**`send-scheduled-reminders`:**
- Remover: `sendPushNotification()`, `sendTelegramNotification()`
- Manter: Logica de janelas de tempo, `schedule_reminders_sent`, criacao de `notifications` com metadata
- WhatsApp envia mensagem curta com link para o card

**`send-announcement-notification`:**
- Remover: `sendPushNotification()`, `sendTelegramNotification()`
- Manter: Auth, busca de membros, criacao de `notifications` com metadata
- WhatsApp envia link para o card

**`send-admin-broadcast`:**
- Remover: Push, Telegram, Email/Resend
- Manter: Auth admin, criacao de `notifications` com metadata
- WhatsApp envia link para o card

---

### 4. Rota Frontend para Visualizar Notificacao

Criar pagina `src/pages/ViewNotification.tsx` acessivel em `/n/:id` que:
- Chama a edge function `view-notification` passando o ID
- A edge function retorna o HTML completo do card
- Renderiza o HTML no navegador (ou alternativamente, a edge function retorna HTML diretamente e a rota redireciona)

**Abordagem mais simples:** A edge function retorna HTML diretamente. O link no WhatsApp aponta para `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/view-notification?id={notification_id}`. Nao precisa de rota no frontend.

---

### 5. Remover Componentes/Hooks de Push e Telegram do Frontend

**Remover arquivos:**
- `src/components/PushNotificationToggle.tsx`
- `src/components/TelegramLinkToggle.tsx`
- `src/hooks/usePushNotifications.tsx`

**Editar `src/pages/Security.tsx`:**
- Remover imports de `usePushNotifications`, `TelegramLinkToggle`, `PushNotificationToggle`
- Remover card de Push Notifications e card de Telegram
- Manter apenas WhatsApp como canal de notificacao nas configuracoes

**Editar `src/components/PWAAutoInstaller.tsx`:**
- Remover referencia a `usePushNotifications`

**Editar `src/pages/Auth.tsx`:**
- Atualizar texto que menciona "Email, Push, Telegram e WhatsApp" para apenas "WhatsApp"

---

### 6. Formato da Mensagem WhatsApp

Mensagem curta e elegante com link:
```
📅 *Nova Escala — Louvor*

Olá, *Maria*! Você foi escalada.

📆 Segunda, 23 de Fevereiro de 2026
⏰ 19:00 às 21:00

👉 Ver detalhes completos:
https://.../view-notification?id=abc123

_LEVI — Escalas Inteligentes_
```

---

### Arquivos Modificados/Criados

**Criar:**
1. `supabase/functions/view-notification/index.ts` - Edge function que serve HTML cards

**Editar (Edge Functions):**
2. `supabase/functions/send-schedule-notification/index.ts` - Remover push/telegram/email, adicionar metadata, enviar link
3. `supabase/functions/send-scheduled-reminders/index.ts` - Remover push/telegram, enviar link
4. `supabase/functions/send-announcement-notification/index.ts` - Remover push/telegram, enviar link
5. `supabase/functions/send-admin-broadcast/index.ts` - Remover push/telegram/email, enviar link
6. `supabase/config.toml` - Adicionar view-notification

**Editar (Frontend):**
7. `src/pages/Security.tsx` - Remover Push/Telegram UI
8. `src/components/PWAAutoInstaller.tsx` - Remover usePushNotifications
9. `src/pages/Auth.tsx` - Atualizar texto de canais

**Remover:**
10. `src/components/PushNotificationToggle.tsx`
11. `src/components/TelegramLinkToggle.tsx`
12. `src/hooks/usePushNotifications.tsx`

**Migracao SQL:**
13. Adicionar coluna `metadata jsonb` na tabela `notifications`

