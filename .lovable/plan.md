

## Comunicação Global do Admin (LEVI) com Todos os Usuários

### Visão Geral

Criar uma seção no painel Admin que permita enviar mensagens para **todos os usuários cadastrados** simultaneamente, usando o nome **LEVI** como remetente. Os canais de envio serão:

1. **In-app** -- notificação dentro do app (sino de notificações)
2. **E-mail** -- via Resend API (já configurada)
3. **Telegram** -- para usuários vinculados (já configurado)
4. **Push** -- notificação push via PushAlert (já configurado)

**Nota sobre WhatsApp:** O sistema não utiliza mais WhatsApp para notificações (foi substituído por push nativo). SMS via Zenvia aguarda credenciais. Portanto, WhatsApp não será incluído neste momento.

### O que será criado

**1. Nova Edge Function: `send-admin-broadcast`**

Uma função backend que:
- Valida que o chamador possui role `admin`
- Busca todos os perfis com e-mail
- Insere notificações in-app para cada usuário
- Envia e-mail em lote via Resend (remetente: "LEVI")
- Dispara push notifications para todos
- Envia Telegram para usuários vinculados
- Retorna contadores de sucesso por canal

**2. Nova tabela: `admin_broadcasts`**

Para manter histórico das mensagens enviadas:
- `id`, `admin_user_id`, `title`, `message`, `channels_used` (array), `recipients_count`, `created_at`

**3. UI no painel Admin (Admin.tsx)**

Uma nova seção colapsável "Comunicados LEVI" com:
- Campo de título da mensagem
- Campo de corpo da mensagem (textarea)
- Checkboxes para selecionar canais (In-app, E-mail, Push, Telegram)
- Botão "Enviar para todos"
- Confirmação via AlertDialog antes do envio
- Histórico dos últimos comunicados enviados

### Detalhes Técnicos

**Tabela `admin_broadcasts` (migration SQL):**

```text
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  channels_used text[] NOT NULL DEFAULT '{}',
  recipients_count integer NOT NULL DEFAULT 0,
  email_sent integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0,
  telegram_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts"
  ON public.admin_broadcasts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

**Edge Function `send-admin-broadcast/index.ts`:**

- Recebe: `{ title, message, channels: string[] }` (ex: `["inapp", "email", "push", "telegram"]`)
- Valida admin via `has_role` RPC
- Busca todos os profiles (id, email, name) usando service role
- Para cada canal selecionado:
  - **inapp**: Insert em `notifications` com `type: 'admin_broadcast'`, `message: "LEVI: {title}"`, sem `department_id`
  - **email**: POST para Resend API com `from: "LEVI <onboarding@resend.dev>"`, HTML formatado
  - **push**: Chama `send-push-notification` com todos os user IDs, título "📢 LEVI" 
  - **telegram**: Chama `send-telegram-notification` para cada usuário vinculado
- Insere registro em `admin_broadcasts` com contadores
- Retorna `{ success, recipients, email_sent, push_sent, telegram_sent }`

**Config (supabase/config.toml):**

```text
[functions.send-admin-broadcast]
verify_jwt = false
```
(Validação de admin feita no código)

**UI no Admin.tsx:**

- Seção colapsável com ícone de megafone
- Formulário com campos de título e mensagem
- 4 checkboxes (In-app, E-mail, Push, Telegram) -- todos marcados por padrão
- AlertDialog de confirmação mostrando contagem de usuários e canais selecionados
- Após envio, toast de sucesso com resumo (ex: "Enviado para 45 usuários: 45 in-app, 40 e-mail, 12 push, 8 Telegram")
- Tabela colapsável com histórico de broadcasts anteriores

### Arquivos a Modificar/Criar

1. **Criar** `supabase/functions/send-admin-broadcast/index.ts`
2. **Modificar** `supabase/config.toml` -- adicionar config da nova function
3. **Modificar** `src/pages/Admin.tsx` -- adicionar seção de comunicados
4. **Migration SQL** -- criar tabela `admin_broadcasts`
