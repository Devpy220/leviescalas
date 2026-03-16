

## Plano: Ajustes nas mensagens de apoio, lembretes e limpeza de código

### 1. Mensagens de apoio via WhatsApp — recriar edge function com botão de copiar

A função `send-support-whatsapp` foi deletada anteriormente. Precisa ser recriada com as mudanças:
- **Frequência**: 4x/mês em dias fixos (1, 8, 16, 24) ao invés de 2x (1 e 16)
- **Mensagem**: Incluir a chave PIX como texto copiável (`suport@leviescalas.com.br`) em vez de um link `mailto:` que abre o e-mail
- **Criar edge function** `supabase/functions/send-support-whatsapp/index.ts` que busca todos os profiles com WhatsApp e envia mensagem de apoio
- **Criar cron job** via SQL insert para chamar a função nos dias 1, 8, 16 e 24 às 12:00 BRT

### 2. Remover lembrete de 72h

**`supabase/functions/send-scheduled-reminders/index.ts`**
- Remover a entrada `{ type: '72h', hoursAhead: 72, label: 'em 3 dias' }` do array `REMINDER_WINDOWS`
- Manter apenas 48h, 12h e 3h

### 3. Limpeza de código morto

**`supabase/functions/send-whatsapp-notification/index.ts`**
- Remover parâmetros não utilizados: `linkUrl`, `title`, `linkDescription`
- Remover lógica `send-link` (nunca mais usada, todas as notificações são texto puro)
- Simplificar para usar apenas `send-text`

**`src/components/SupportNotification.tsx`**
- Componente não é importado em nenhum lugar — **deletar**

**`src/lib/constants.ts`**
- Remover `SUPPORT_NOTIFICATION_LAST_SHOWN` do `STORAGE_KEYS` (referenciado apenas pelo componente deletado)

### Resumo dos arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/send-support-whatsapp/index.ts` | Criar (novo) |
| `supabase/functions/send-scheduled-reminders/index.ts` | Editar (remover 72h) |
| `supabase/functions/send-whatsapp-notification/index.ts` | Editar (remover send-link) |
| `src/components/SupportNotification.tsx` | Deletar |
| `src/lib/constants.ts` | Editar (remover chave não usada) |
| SQL (cron job) | Criar via insert tool |

