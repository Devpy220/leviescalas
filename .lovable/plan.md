
## Integracao WhatsApp via Z-API

Adicionar o canal **WhatsApp** via Z-API em todos os pontos de notificacao do sistema: comunicados admin (broadcast), lembretes automaticos de escala e notificacoes individuais de nova escala/alteracao.

---

### Segredos Necessarios

Configurar 3 secrets no backend:
- `ZAPI_INSTANCE_ID` - ID da instancia Z-API
- `ZAPI_TOKEN` - Token da instancia
- `ZAPI_CLIENT_TOKEN` - Token de seguranca da conta

---

### Nova Edge Function

**`supabase/functions/send-whatsapp-notification/index.ts`**

Funcao centralizada para envio de WhatsApp que sera chamada pelas demais funcoes. Responsabilidades:
- Receber `phone` (numero) e `message` (texto)
- Limpar numero, garantir formato `55XXXXXXXXXXX`
- Chamar `POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text` com header `Client-Token`
- Body: `{ phone, message }`
- Retornar `{ sent: true/false }`

---

### Alteracoes em Edge Functions Existentes

**1. `send-schedule-notification/index.ts`**
- Adicionar chamada paralela ao `send-whatsapp-notification` junto com push, email e telegram
- Enviar a mensagem `whatsappMessage` (ja existente no codigo) via Z-API em vez de apenas Telegram
- O numero vem do campo `profile.whatsapp`

**2. `send-admin-broadcast/index.ts`**
- Adicionar canal `"whatsapp"` na logica de canais
- Iterar sobre destinatarios que possuem `whatsapp` preenchido
- Chamar `send-whatsapp-notification` para cada um
- Adicionar contador `whatsappSent` e salvar na tabela `admin_broadcasts`

**3. `send-scheduled-reminders/index.ts`**
- Adicionar chamada ao `send-whatsapp-notification` em paralelo com push, telegram e SMS
- Usar o numero do perfil (`profile.whatsapp`)

**4. `send-announcement-notification/index.ts`**
- Adicionar envio WhatsApp para membros do departamento que possuem numero cadastrado

---

### Migracoes de Banco

- Adicionar coluna `whatsapp_sent integer default 0` na tabela `admin_broadcasts` para rastrear envios por WhatsApp

---

### Frontend (Admin.tsx)

- Adicionar checkbox **"📲 WhatsApp"** na lista de canais de broadcast (ao lado de SMS, Telegram, etc.)
- Incluir `whatsapp` no array default de `broadcastChannels`
- Atualizar o mapeamento de labels no dialog de confirmacao e no toast de sucesso
- Mostrar `whatsapp_sent` no resumo de envio

---

### Configuracao do config.toml

Adicionar entrada para a nova funcao:
```text
[functions.send-whatsapp-notification]
verify_jwt = false
```

---

### Detalhes Tecnicos

**Endpoint Z-API:**
```text
POST https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}/send-text
Header: Client-Token: {ZAPI_CLIENT_TOKEN}
Body: { "phone": "5511999999999", "message": "texto" }
```

**Formato do numero:** O campo `profiles.whatsapp` ja armazena numeros BR. A funcao limpa caracteres nao-numericos e garante prefixo `55`.

**Sem limite de caracteres:** Diferente do SMS (160 chars), WhatsApp permite mensagens longas com formatacao (*negrito*, _italico_).

**Ordem de execucao:** WhatsApp sera enviado em paralelo com os demais canais (push, email, telegram, sms) usando `Promise.all` / `Promise.allSettled`.
