

## Plano: Envios sem padrão (até 10 min entre msgs) + lembrete extra de 36h

### Objetivo

1. Eliminar qualquer padrão temporal nos envios em massa: delay aleatório de **10s a 600s (10 min)** entre mensagens, aplicado a **todos** os fluxos (lembretes, avisos do líder, broadcasts, suporte, coleta de bloqueios).
2. Adicionar uma segunda janela de lembrete de escala: **36h antes** (além do já existente de 12h).
3. Manter `delayTyping` randômico (3–8s) por mensagem.
4. A primeira mensagem do lote **dispara imediatamente**; as demais entram na fila com intervalos aleatórios.

### Mudanças

**1. `_shared/whatsapp-queue.ts`**

Ampliar a faixa de delay padrão:

```ts
const minDelay = opts.minDelayMs ?? 10_000;   // 10s
const maxDelay = opts.maxDelayMs ?? 600_000;  // 10 min
```

A primeira mensagem (`i = 0`) já é enviada imediatamente — só insere `setTimeout` **entre** mensagens (lógica atual já faz isso, só os limites mudam).

`backgroundThreshold` cai de 3 → **2** (qualquer lote com 2+ destinatários roda em background via `EdgeRuntime.waitUntil`, já que 2 msgs podem levar até 10 min).

**2. `send-scheduled-reminders/index.ts`**

Adicionar a janela de 36h junto com a de 12h:

```ts
const REMINDER_WINDOWS = [
  { type: '36h', hoursAhead: 36, label: 'em 36 horas' },
  { type: '12h', hoursAhead: 12, label: 'em 12 horas' },
];
```

Como `schedule_reminders_sent` já tem `(schedule_id, reminder_type)` como chave, cada escala receberá **2 lembretes distintos** (36h e 12h) sem duplicar. Ambos passam pelo mesmo embaralhamento entre departamentos e pela fila com delay 10s–10min.

**3. Demais funções em lote** (sem mudança de código — herdam o novo default)

- `send-announcement-notification` (avisos imediatos do líder)
- `send-delayed-announcements` (avisos 30 min depois)
- `send-admin-broadcast` (comunicados LEVI)
- `send-support-whatsapp` (mensagem PIX)
- `send-blackout-collection-prompt` (coleta de bloqueios)

Todas já usam `scheduleBatch`/`sendWhatsAppBatch` sem passar `minDelayMs`/`maxDelayMs`, então automaticamente passam a usar 10s–10min.

**4. Confirmações 1-a-1 (webhook Z-API)**

`zapi-webhook-receive` continua respondendo na hora (resposta direta ao usuário não entra em fila — só o `delayTyping` 3–8s é mantido).

### Considerações

- **Timeouts**: com até 10 min entre msgs, lotes grandes só funcionam via `EdgeRuntime.waitUntil` (já implementado). Threshold reduzido para 2 garante que praticamente todo lote vai pra background.
- **Janela de 36h em escalas existentes**: a primeira execução do cron após o deploy pode disparar 36h para escalas que já estavam dentro dessa janela (não receberam ainda porque o tipo não existia). Isso é desejado — recupera o aviso que faltava.
- **Embaralhamento**: o shuffle entre departamentos no `send-scheduled-reminders` continua, agora misturando também as duas janelas (36h e 12h) no mesmo ciclo.

### Arquivos

- **Editar**: `supabase/functions/_shared/whatsapp-queue.ts` — defaults de delay e threshold
- **Editar**: `supabase/functions/send-scheduled-reminders/index.ts` — adicionar janela de 36h

### Não faz parte

- Não altera `send-whatsapp-notification` (delayTyping 3–8s já está aleatório e segue igual)
- Não altera o webhook de resposta nem envios pontuais (`send-schedule-notification`, `send-contact-email`)
- Não muda o cron da coleta de bloqueios nem o conteúdo das mensagens

