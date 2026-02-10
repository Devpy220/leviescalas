
# Lembretes Multi-Horario (72h, 48h, 12h, 3h) + Permissao Automatica

## Resumo

Implementar lembretes de escala em **4 momentos** antes do horario da escala (72h, 48h, 12h, 3h), usando notificacoes push no aparelho como canal principal. Ao instalar o app (PWA), pedir automaticamente autorizacao de notificacao.

## Mudancas

### 1. Permissao automatica ao instalar o PWA

**Arquivo: `src/components/PWAAutoInstaller.tsx`**

Apos o prompt de instalacao do PWA (ou ao fechar o modal iOS), chamar automaticamente o fluxo de `subscribe()` do hook `usePushNotifications` para solicitar permissao de notificacao. Isso garante que o usuario receba o pedido de permissao no momento mais natural -- logo apos instalar o app.

### 2. Nova Edge Function: `send-scheduled-reminders`

**Arquivo: `supabase/functions/send-scheduled-reminders/index.ts`**

Reescrever a logica de lembretes para funcionar com intervalos baseados em hora (nao apenas "amanha"):

- Ao ser chamada (via cron a cada 30 minutos), a funcao:
  1. Calcula os 4 "janelas" de tempo: escalas que comecam daqui a ~72h, ~48h, ~12h, ~3h (com margem de 30 min)
  2. Para cada escala encontrada, verifica na tabela `schedule_reminders_sent` se o lembrete daquele intervalo ja foi enviado
  3. Se nao foi enviado, dispara push notification e registra na tabela

- Mensagens personalizadas por intervalo:
  - 72h: "Voce tem escala em 3 dias em [departamento]"
  - 48h: "Lembrete: escala em 2 dias em [departamento]"
  - 12h: "Sua escala e amanha! [departamento] as [hora]"
  - 3h: "Em 3 horas: [departamento] as [hora]"

### 3. Tabela de controle de lembretes enviados

**Nova migracao SQL**

```sql
CREATE TABLE public.schedule_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '72h', '48h', '12h', '3h'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, reminder_type)
);

ALTER TABLE public.schedule_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.schedule_reminders_sent
  FOR ALL USING (false);
```

Essa tabela garante que cada lembrete seja enviado apenas uma vez por escala, mesmo se o cron rodar varias vezes.

### 4. Cron Job (pg_cron + pg_net)

Agendar a funcao para rodar a cada 30 minutos, cobrindo todas as janelas de lembrete:

```sql
SELECT cron.schedule(
  'schedule-reminders-multi',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-scheduled-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 5. Atualizar PWAAutoInstaller para pedir permissao

**Arquivo: `src/components/PWAAutoInstaller.tsx`**

- Importar `usePushNotifications`
- Apos instalacao bem-sucedida (Android/Desktop) ou apos fechar o modal iOS, chamar `subscribe()` automaticamente
- Isso dispara o `Notification.requestPermission()` do navegador

## Arquivos a modificar/criar

| Arquivo | Acao |
|---------|------|
| `src/components/PWAAutoInstaller.tsx` | Adicionar pedido automatico de permissao de notificacao |
| `supabase/functions/send-scheduled-reminders/index.ts` | Nova funcao com logica multi-horario |
| Nova migracao SQL | Tabela `schedule_reminders_sent` + cron job |

## Fluxo

```text
Cron (a cada 30min)
  |
  v
send-scheduled-reminders
  |
  +-- Busca escalas nas janelas 72h/48h/12h/3h
  |
  +-- Filtra as que ja foram notificadas (schedule_reminders_sent)
  |
  +-- Para cada pendente:
       +-- Envia push notification (send-push-notification)
       +-- Registra na tabela schedule_reminders_sent
       +-- Cria registro em notifications (in-app)
```
