## Migração Z-API → UAZAPI

Substituir totalmente o Z-API pela UAZAPI, mantendo idêntico o fluxo de respostas ("troca", "servir", coleta de bloqueios, menus interativos, efeito "digitando…", etc.).

### Pré-requisito (você precisa fazer antes)

1. Criar conta em https://uazapi.com
2. Criar uma **instância** e conectar o WhatsApp (QR Code) — usar o MESMO número que está no Z-API hoje para não perder o histórico de conversas.
3. Anotar:
   - **Token da instância** (UAZAPI_TOKEN)
   - **URL base do servidor** (UAZAPI_BASE_URL — algo como `https://free.uazapi.com` ou o host dedicado que a UAZAPI fornecer)
4. Na UAZAPI, configurar o **Webhook** apontando para:
   `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/zapi-webhook-receive`
   (mantemos o mesmo nome de função para não quebrar nada externamente; ele passa a tratar o payload UAZAPI)
   Eventos: `messages` (mensagens recebidas).

Quando estiver pronto, eu peço via formulário seguro:
- `UAZAPI_TOKEN`
- `UAZAPI_BASE_URL`
- `UAZAPI_WEBHOOK_SECRET` (rotacionado — substitui o `ZAPI_WEBHOOK_SECRET`)

### O que vai mudar no código

**Novo módulo compartilhado** `supabase/functions/_shared/uazapi.ts`:
- `sendText(phone, message)` → POST `${UAZAPI_BASE_URL}/send/text` com headers `token: UAZAPI_TOKEN`, body `{ number, text, delay }`.
- `sendPresence(phone, action: "composing"|"paused", delayMs)` → POST `/message/presence` para manter o efeito "digitando…" humanizado já existente.
- Mantém a mesma assinatura usada hoje pelo wrapper Z-API para minimizar diff.

**Edge functions atualizadas** (trocam chamada direta `api.z-api.io` pelo novo helper):
- `send-whatsapp-notification/index.ts`
- `create-church-public/index.ts`
- `send-church-code-email/index.ts`
- `_shared/whatsapp-queue.ts` (fila de lembretes)
- `_shared/messageVariants.ts` (sem mudança lógica — só consome o helper)

**Webhook inbound** `zapi-webhook-receive/index.ts`:
- Renomeado internamente, mas mantém a rota.
- Passa a ler o payload UAZAPI (`event: "messages.upsert"`, campos `message.text`, `chat.id`, `sender.id`). Mantém parser antigo como fallback durante a janela de corte, depois removido.
- Verifica `UAZAPI_WEBHOOK_SECRET` via header `x-webhook-secret` (UAZAPI permite header customizado).
- Toda a lógica de "troca", "servir", menus numéricos, coleta de bloqueios, rate-limit de 60min continua intacta.

**Logs**: a tabela `whatsapp_logs` continua igual — só passa a registrar `provider: "uazapi"` no campo de resposta para auditoria.

**Limpeza de secrets** (após validação): remover `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_WEBHOOK_SECRET`.

### Plano de validação

1. Após deploy, enviar 1 mensagem de teste via Admin Broadcast para o seu número.
2. Responder "troca" para validar webhook inbound + menu interativo.
3. Conferir registros em `WhatsApp Logs`.
4. Disparar 1 lembrete agendado manual e validar efeito "digitando…".
5. Só então remover os secrets antigos do Z-API.

### Riscos

- **Formato de telefone**: UAZAPI aceita `5511999999999` (sem `+`, sem `@c.us`). Vou normalizar no helper, igual fazemos hoje.
- **Rate / delay**: UAZAPI tem parâmetro `delay` nativo (ms) — vou aproveitar em vez do `setTimeout` manual, reduzindo tempo de execução das edge functions.
- **Mídia**: hoje não enviamos mídia pelo Z-API, só texto — então sem impacto.

Quando aprovar, eu já começo pelos secrets e pela função compartilhada.