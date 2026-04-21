

## Plano: Coleta automática de bloqueios via WhatsApp

### Como vai funcionar

**1. Aviso no último dia do mês (cron)**

Nova edge function `send-blackout-collection-prompt` rodando às **20:00 do último dia de cada mês** (cron). Para cada voluntário ativo (membro de pelo menos 1 departamento, com WhatsApp cadastrado):

- Envia **uma única mensagem** consolidada (mesmo que esteja em vários departamentos):
  > 📅 *Levi — Bloqueios do próximo mês*
  >
  > Olá *{nome}*! Amanhã começa **{mês}**.
  > Se tiver dias que **não pode servir**, responda esta mensagem com as datas. Exemplos:
  > • `5, 12, 19`
  > • `05/12 e 22/12`
  > • `dia 7 e 14`
  >
  > Para liberar todos os dias, responda *nenhum*.
  > Você tem até o dia 3 para responder.
  
- Usa `sendWhatsAppBatch` (delay 10–50s entre voluntários + `delayTyping` 3–8s). Como geralmente passa de 3 destinatários, roda em background via `EdgeRuntime.waitUntil`.

**2. Recebimento de respostas (webhook Z-API)**

Nova edge function pública `zapi-webhook-receive` (sem JWT). Configurada no painel Z-API como webhook de "mensagem recebida":

- Recebe `{ phone, text }` da Z-API
- Faz match do `phone` com `profiles.whatsapp` (normalizando dígitos)
- Verifica se há um **prompt de coleta ativo** para esse usuário (janela: do dia 28 do mês atual até dia 5 do mês seguinte) — controlado por uma nova tabela `blackout_collection_prompts`
- Faz parse das datas no texto:
  - Aceita `5`, `05`, `05/12`, `5 de dezembro`, separadores `,`, `e`, `;`, espaço, quebra de linha
  - Datas só com dia → assume mês seguinte ao prompt
  - Palavra `nenhum` / `nada` / `livre` → limpa lista
  - Ignora datas inválidas e anteriores a hoje
- Para cada departamento do voluntário: faz `upsert` em `member_preferences`, **adicionando** as novas datas ao `blackout_dates` existente (sem ultrapassar `departments.max_blackout_dates`)
- Marca o prompt como respondido e envia confirmação WhatsApp:
  > ✅ Anotado, *{nome}*! Bloqueei: 05/12, 12/12, 19/12.
  > Se errei alguma data, responda novamente.
  
  Se passar do limite: avisa quantas foram aceitas e quais ficaram de fora.

**3. Tabela nova: `blackout_collection_prompts`**

| coluna | tipo |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid |
| `target_month` | date (1º dia do mês de bloqueio) |
| `sent_at` | timestamptz |
| `responded_at` | timestamptz nullable |
| `parsed_dates` | date[] |

RLS: só service_role. Garante idempotência (1 prompt por user/mês) e dá janela pra casar a resposta.

**4. Cron**

```sql
-- Roda diariamente 20:00 BRT (23:00 UTC); a função verifica internamente se hoje é o último dia do mês.
SELECT cron.schedule(
  'blackout-collection-prompt',
  '0 23 * * *',
  $$ SELECT net.http_post(
    url := 'https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-blackout-collection-prompt',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON>"}'::jsonb
  ); $$
);
```

### Fluxo

```text
Último dia do mês 20:00 ──► cron ──► send-blackout-collection-prompt
                                       │
                                       ├─ insere blackout_collection_prompts (1/user)
                                       └─ sendWhatsAppBatch (delay + typing)

Voluntário responde "5, 12, 19" no WhatsApp
        │
        ▼
  Z-API webhook ──► zapi-webhook-receive
                      │
                      ├─ acha prompt ativo do user
                      ├─ parse datas → [2026-05-05, 2026-05-12, 2026-05-19]
                      ├─ upsert member_preferences.blackout_dates (todos os depts do user)
                      └─ envia confirmação WhatsApp
```

### Detalhes técnicos

- **Webhook URL pública**: `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/zapi-webhook-receive` — após deploy precisa ser configurada no painel Z-API ("Ao receber").
- **Validação `verify_jwt = false`** no `config.toml` para a webhook function.
- **Parser** isolado num módulo testável dentro da função (`parseBlackoutDates(text, targetMonth) → Date[]`).
- **Limite por departamento**: respeita `departments.max_blackout_dates` por departamento.
- **Privacidade**: webhook só responde se o telefone bater com algum `profiles.whatsapp`; ignora silenciosamente o resto.
- **Anti-spam**: as confirmações também passam pelo `delayTyping` (3–8s) — sem batch porque é resposta 1-a-1.

### Arquivos

- **Migration**: criar `blackout_collection_prompts` + cron job
- **Criar**: `supabase/functions/send-blackout-collection-prompt/index.ts`
- **Criar**: `supabase/functions/zapi-webhook-receive/index.ts`
- **Editar**: `supabase/config.toml` (adicionar bloco `[functions.zapi-webhook-receive]` com `verify_jwt = false`)

### Não faz parte

- Não cria UI nova — tudo é background + WhatsApp
- Não altera `MemberPreferences.tsx` (continua funcionando manualmente)
- Não envia lembrete de "você não respondeu" (pode ser fase 2)

### Dependência manual (você precisa fazer 1x)

Depois do deploy, abrir o painel Z-API → **Webhooks** → "Ao receber" → colar a URL `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/zapi-webhook-receive`. Sem isso o LEVI não recebe as respostas.

