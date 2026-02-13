

# Integrar Notificacoes via Telegram no LEVI

## Passo a Passo para Voce (Usuario)

### 1. Criar o Bot no Telegram

1. Abra o Telegram e procure por **@BotFather**
2. Envie o comando `/newbot`
3. Escolha um **nome** para o bot (ex: "LEVI Escalas")
4. Escolha um **username** para o bot (ex: `levi_escalas_bot`) - deve terminar com `bot`
5. O BotFather vai te enviar um **token** parecido com: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`
6. **Guarde esse token** - voce vai precisar cola-lo no proximo passo

### 2. Fornecer o Token ao Sistema

Apos criar o bot, eu vou pedir para voce colar o token do bot. Ele sera armazenado de forma segura como secret (`TELEGRAM_BOT_TOKEN`).

---

## O Que Sera Implementado (Tecnico)

### 1. Tabela `telegram_links` no banco de dados

Armazena o vinculo entre usuario do LEVI e chat_id do Telegram:

```
telegram_links:
  - id (uuid)
  - user_id (uuid) -> referencia ao usuario
  - chat_id (bigint) -> ID do chat Telegram
  - username (text) -> username Telegram (opcional)
  - linked_at (timestamptz)
  - is_active (boolean)
```

Com RLS para usuarios verem/gerenciarem apenas seus proprios vinculos.

### 2. Edge Function `telegram-webhook`

Recebe mensagens do Telegram (webhook configurado automaticamente):
- Quando usuario envia `/start CODIGO`, vincula a conta
- Quando usuario envia `/parar`, desvincula

### 3. Edge Function `send-telegram-notification`

Envia mensagens via Telegram Bot API para usuarios vinculados. Sera chamada pelas funcoes existentes (`send-schedule-notification`, `send-scheduled-reminders`).

### 4. Componente `TelegramLinkToggle`

Similar ao `PushNotificationToggle`, permite ao usuario:
- Gerar um codigo de vinculacao de 6 digitos (valido por 5 minutos)
- Ver instrucoes: "Abra o Telegram, procure @levi_escalas_bot e envie: /start CODIGO"
- Ver status: vinculado/desvinculado
- Desvincular a conta

### 5. Integrar nas notificacoes existentes

Atualizar `send-schedule-notification` e `send-scheduled-reminders` para tambem enviar via Telegram (alem de email e push), quando o usuario tiver conta vinculada.

### 6. Adicionar toggle na pagina de Seguranca/Configuracoes

Colocar o `TelegramLinkToggle` junto ao `PushNotificationToggle` existente para o usuario gerenciar seus canais de notificacao.

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `telegram_links` + RLS |
| `supabase/functions/telegram-webhook/index.ts` | Criar - recebe mensagens do Telegram |
| `supabase/functions/send-telegram-notification/index.ts` | Criar - envia mensagens via Telegram |
| `supabase/config.toml` | Adicionar novas funcoes |
| `src/components/TelegramLinkToggle.tsx` | Criar - UI para vincular Telegram |
| `src/pages/Security.tsx` | Adicionar toggle do Telegram |
| `supabase/functions/send-schedule-notification/index.ts` | Adicionar canal Telegram |
| `supabase/functions/send-scheduled-reminders/index.ts` | Adicionar canal Telegram |

## Primeiro Passo Necessario

Antes de implementar, preciso que voce **crie o bot no Telegram** seguindo as instrucoes acima e me forneca o token. Sem o token, nao e possivel configurar o webhook nem enviar mensagens.

