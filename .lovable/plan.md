
## Objetivo

Reformular como o LEVI se comunica no WhatsApp: cada mensagem principal (aviso mensal de bloqueio, lembrete de escala, broadcast/anúncio e apoio) passa a ser enviada em **3 partes separadas** com pausas humanizadas, adicionar comandos para todos os dias da semana, calendário ASCII do próximo mês no aviso de bloqueio, remover o comando `menu`, e revisar disparos + postura de segurança.

---

## 1. Split em 3 mensagens (todas as mensagens principais do LEVI)

Padrão novo para aviso mensal, lembrete de escala, broadcast admin, anúncio de departamento e apoio:

- **Msg 1 — Conteúdo principal** (aviso/escala/anúncio/apoio)
  - Só a mensagem tipo Escala inclui o link do Instagram ELSD no final.
  - As demais NÃO incluem Instagram.
- **Msg 2 — Apoie o LEVI** (PIX/Cakto, sugestão R$ 25,00, link `/apoiar`).
- **Msg 3 — Comandos que o LEVI entende** (o `LEVI_COMMANDS_HINT` atualizado).

Implementação: nova função `sendLeviTriplet()` em `_shared/whatsapp-queue.ts` (ou helper novo em `_shared/messageVariants.ts`) que enfileira as 3 mensagens em sequência para o mesmo telefone, com delay natural de 8-25 s entre elas (variável, tipo "digitando…"). Já existe o efeito de typing na camada UAZAPI — só precisamos garantir intervalo entre msgs.

Funções edge a atualizar para usar o novo helper:
- `send-scheduled-reminders` (Instagram sim na msg 1).
- `send-blackout-collection-prompt` (Instagram não).
- `send-admin-broadcast` (Instagram não).
- `send-announcement-notification` (Instagram não).
- `send-support-whatsapp` (msg 1 é a própria de apoio; nesse caso vira só 2 msgs: principal + comandos, sem duplicar apoio).
- `auto-notify-schedule` (Instagram sim).

Cada uma para de embutir `LEVI_COMMANDS_HINT`, `INSTAGRAM_LINK` e o bloco de apoio dentro do template — vão como envios separados.

---

## 2. Novos comandos WhatsApp (webhook `zapi-webhook-receive`)

### Remover
- `menu` — deletar da lista de gatilhos de "ajuda"; manter `ajuda` e `comandos`.

### Adicionar — bloqueio/servir por dia da semana (só afeta o **próximo mês**)

Aceitar variantes normalizadas (sem acento, minúsculo) para os 7 dias:

| Palavra-chave                       | Efeito                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| `bloquear segundas`                 | Bloqueia todas as segundas do próximo mês                         |
| `bloquear terças`                   | idem terças                                                       |
| `bloquear quartas` / `todas as quartas` | idem                                                          |
| `bloquear quintas`                  | idem                                                              |
| `bloquear sextas`                   | idem                                                              |
| `bloquear sábados`                  | idem                                                              |
| `bloquear domingos`                 | idem (ambos turnos)                                               |
| `bloquear domingos de manhã`        | só o turno matutino                                               |
| `bloquear domingos de noite`        | só o turno noturno                                                |
| `servir segundas` … `servir domingos` | mantém só esse dia da semana no próximo mês, bloqueia o resto   |
| `servir domingos de manhã/noite`    | idem com turno                                                    |

Reutiliza `FIXED_SLOTS_DEF` de `_shared/scheduleDates.ts` e o mesmo caminho que já grava em `blackout_dates`. Adiciona um parser genérico `parseWeekdayCommand(text)` que retorna `{ action: 'block'|'serve', weekday: 0-6, shift?: 'manha'|'noite' }`.

**Janela de validade:** comandos `bloquear …` e `servir …` continuam ativos até o **último dia do mês corrente** (deadline atual do prompt). A resposta de confirmação do LEVI deve dizer isso explicitamente ("Vale até dia X/MM. Depois disso o mês seguinte reabre.").

### Novos comandos utilitários (leves, sem novos disparos)
- `minhas escalas` (alias de `escala`) — já existe, só reforçar.
- `apoiar` — envia direto a msg de apoio + link.
- `bloqueios` — lista os dias que o usuário já bloqueou no mês seguinte.

---

## 3. Calendário ASCII do próximo mês (em `send-blackout-collection-prompt`)

Trocar a lista `• Dom 05/07 — manhã e/ou noite` por uma grade compacta:

```text
📅 JULHO 2026
Dom Seg Ter Qua Qui Sex Sáb
             1   2   3   4
 5   6   7   8   9  10  11
12  13  14  15  16  17  18
19  20  21  22  23  24  25
26  27  28  29  30  31
```

Marcadores nos números:
- `✅` (envolvendo) = dia em que você pode ser escalado (candidato).
- `·` = dia sem culto no seu departamento.
- Domingos com dois turnos ganham subscrito `ᴹ`/`ᴺ` quando só um turno está disponível.

Legenda embaixo do calendário + a lista textual atual permanece logo abaixo (redundante mas útil em telefones que quebram o alinhamento monoespaçado). Envolver a grade em ``` ``` ``` (bloco de código WhatsApp) para preservar espaçamento.

Novo helper `buildAsciiMonthCalendar(year, monthIdx, candidateISO[])` em `_shared/scheduleDates.ts`.

---

## 4. Cadência do aviso mensal — confirmação

O cron `send-blackout-collection-prompt` já dispara **apenas no antepenúltimo dia do mês** (`isThirdToLastDayOfMonth`). Vou:
- Reafirmar essa condição (sem `force one-shot`).
- Adicionar teste manual (`?dry=1`) que retorna quantos seriam enviados sem gravar `blackout_collection_prompts` — útil para checar sem disparar.
- Garantir que a linha "Prazo: até dia X" continue correta e adicionar frase "*Depois desse dia, os comandos `bloquear/servir` valem para o mês seguinte.*".

---

## 5. Revisão dos disparos existentes

Checklist a executar antes de fechar:

1. `send-scheduled-reminders` — confirmar janelas 15h/10h (manhã), 10h/6h (noite), 18h/6h (outros) e que agora enfileira triplet (escala + apoio + comandos, Instagram na msg de escala).
2. `send-blackout-collection-prompt` — antepenúltimo dia, calendário ASCII, triplet sem Instagram.
3. `send-admin-broadcast` — triplet sem Instagram, respeita filtro "apenas líderes".
4. `send-announcement-notification` — triplet sem Instagram.
5. `send-support-whatsapp` — 2 envios (apoio principal + comandos), sem Instagram.
6. `zapi-webhook-receive` (na verdade UAZAPI) — remover `menu`, adicionar parser de dias da semana, comandos `apoiar` e `bloqueios`, mensagem de confirmação inclui validade "até dd/mm".
7. `whatsapp_queue` — checar retry/backoff e que os 3 envios não são fundidos por dedupe.

---

## 6. Segurança — varredura pós-mudanças

Rodar `security--run_security_scan` depois das alterações e conferir:
- Edge functions novas/atualizadas exigem `requireCronAuth` OU sessão admin (padrão que já usamos).
- Nenhuma nova coluna sensível exposta.
- Rate-limit dos webhooks continua ativo.
- Nenhum secret vazando em logs (não logar payload cru do UAZAPI, só campos necessários).
- Confirmar que `UAZAPI_WEBHOOK_SECRET`, `CRON_SECRET`, `CAKTO_WEBHOOK_SECRET` continuam sendo lidos e validados.

Findings novos que aparecerem serão corrigidos ou marcados via `manage_security_finding` com justificativa no `@security-memory`.

---

## Detalhes técnicos (para dev)

- **Sem novo schema.** Só código nas edge functions e helpers `_shared`.
- **`_shared/messageVariants.ts`**: remover `menu` do `LEVI_COMMANDS_HINT`; separar em 2 constantes — `LEVI_MAIN_HINT` (sem apoio) e helpers `buildSupportOnlyMessage()`, `buildCommandsOnlyMessage()`.
- **`_shared/whatsapp-queue.ts`**: novo `enqueueTriplet(phone, { main, support, commands }, { instagram: boolean })` → 3 rows em `whatsapp_queue` com `send_after` escalonado (main = agora, support = +8-15 s, commands = +18-30 s).
- **`_shared/scheduleDates.ts`**: `buildAsciiMonthCalendar(...)` + `parseWeekdayCommand(text)`.
- **Idempotência**: `whatsapp_queue` já tem chave — garantir chave por parte (`origin` + `part: 'main'|'support'|'commands'`) pra não bloquear split.

## Arquivos afetados

- `supabase/functions/_shared/messageVariants.ts`
- `supabase/functions/_shared/scheduleDates.ts`
- `supabase/functions/_shared/whatsapp-queue.ts`
- `supabase/functions/send-scheduled-reminders/index.ts`
- `supabase/functions/send-blackout-collection-prompt/index.ts`
- `supabase/functions/send-admin-broadcast/index.ts`
- `supabase/functions/send-announcement-notification/index.ts`
- `supabase/functions/send-support-whatsapp/index.ts`
- `supabase/functions/zapi-webhook-receive/index.ts`
- `supabase/functions/auto-notify-schedule/index.ts` (se existir; conferir)

Sem migrations. Sem mudanças de UI.
