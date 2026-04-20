

## Plano: Envio humanizado de WhatsApp com `delayTyping` e variações de texto

### Objetivo

Fazer o envio em massa de WhatsApp (avisos, lembretes, broadcasts) parecer mais humano e evitar bloqueio do Z-API:

1. **`delayTyping`** na própria chamada Z-API (simula "digitando…" antes da mensagem chegar)
2. **Delay aleatório entre mensagens** (10s a 50s por destinatário, média ~35s) — uma de cada vez
3. **Variações de texto** por mensagem (mesmo sentido, frases/saudações/emojis alternados) pra cada destinatário receber uma versão levemente diferente

### Como vai funcionar

**1. `send-whatsapp-notification` (função base)**

- Adicionar suporte a `delayTyping` (segundos que o WhatsApp mostra "digitando…" antes de entregar a mensagem). Z-API aceita o campo `delayMessage` / `delayTyping` no payload de `send-text`.
- Novo payload aceito:
  ```ts
  { phone, message, delayTyping?: number } // default: aleatório 3-8s
  ```
- Se `delayTyping` não vier, sorteia entre 3 e 8 segundos internamente.

**2. Novo helper compartilhado `_shared/whatsapp-queue.ts`**

Cria uma função utilitária única usada por todas as funções em lote:

```ts
async function sendWhatsAppBatch(
  supabaseUrl, serviceRoleKey,
  recipients: { phone, message }[],
  opts?: { minDelayMs?: 10_000, maxDelayMs?: 50_000 }
): Promise<{ sent: number; errors: number }>
```

Comportamento:
- Envia 1 mensagem → sorteia delay entre 10s–50s → envia a próxima → repete.
- Entre cada envio, usa `await new Promise(r => setTimeout(r, delay))`.
- Cada chamada interna já manda `delayTyping` aleatório (3–8s) para a Z-API.

**3. Variações de texto (`messageVariants.ts`)**

Pequena biblioteca de variações por tipo de mensagem, mantendo o sentido:

- **Saudações**: "Olá", "Oi", "Opa", "E aí"
- **Conectores**: "você foi escalado para", "sua escala foi marcada para", "você está na escala de"
- **Fechamento**: "_LEVI — Escalas Inteligentes_", "_Até lá! — LEVI_", "_Nos vemos lá! — LEVI_"
- **Emojis de cabeçalho**: 📢 / 📣 / 🔔 para avisos; 📅 / 🗓️ / ⏰ para escalas

Função `pickVariant(userId, templateKey)` usa hash do `userId + data` para variar mas ser determinística (o mesmo user na mesma rodada recebe a mesma versão).

**4. Integração nas funções existentes**

Substituir os loops `Promise.allSettled(members.map(... fetch send-whatsapp ...))` por `sendWhatsAppBatch(...)` em:

- `send-announcement-notification` (avisos imediatos do líder)
- `send-delayed-announcements` (avisos de 30min depois)
- `send-scheduled-reminders` (lembretes 48h/24h/etc)
- `send-admin-broadcast` (comunicados globais)
- `send-support-whatsapp` (mensagem de suporte/PIX)

O `send-contact-email` e `send-schedule-notification` (envio único pontual) **não mudam** — só recebem `delayTyping` automático.

### ⚠️ Consideração importante sobre timeouts

Edge Functions do Supabase têm limite de execução (~150s wall time). Com delay médio de 35s por mensagem:
- 4 destinatários ≈ 140s ✅
- 10 destinatários ≈ 350s ❌ estoura

**Solução proposta**: quando o lote for grande (>3 destinatários), a função retorna imediatamente `{ queued: N }` e dispara o envio via `EdgeRuntime.waitUntil(sendWhatsAppBatch(...))` (background task do Deno), que continua rodando após o response. Isso é suportado pelo Supabase Edge.

### Detalhes técnicos

- Campo Z-API: `delayMessage` (em segundos, 0–15) é o oficial para "digitando"
- Random helper: `Math.floor(Math.random() * (max - min + 1)) + min`
- Background tasks: `EdgeRuntime.waitUntil(promise)` — permite enviar response 200 e continuar processando
- Variações ficam em um único módulo `_shared/messageVariants.ts` importável por todas as functions

### Arquivos

- **Editar**: `supabase/functions/send-whatsapp-notification/index.ts` (adicionar `delayTyping`)
- **Criar**: `supabase/functions/_shared/whatsapp-queue.ts` (batch com delay aleatório)
- **Criar**: `supabase/functions/_shared/messageVariants.ts` (variações de texto)
- **Editar**: `send-announcement-notification`, `send-delayed-announcements`, `send-scheduled-reminders`, `send-admin-broadcast`, `send-support-whatsapp` (usar o batch helper + variações + `waitUntil` para lotes grandes)

### Não faz parte

- Não altera lógica de quando disparar (janelas de reminder, 30min delay dos avisos, etc.)
- Não adiciona retry/fila persistente em banco (fica em memória da function, suficiente para o volume atual)

