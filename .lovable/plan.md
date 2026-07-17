## Objetivo
Remover completamente o código de retirada de 4 dígitos (pickup_code). O check-out passa a ser feito pelo professor com 1 clique, sem verificação numérica.

## O que muda para o usuário

- **Responsável (KidsCheckin)**: recebe apenas a confirmação "Check-in feito" com nome e sala. Sem "código de retirada".
- **WhatsApp**: mensagem de confirmação passa a ser só "Check-in confirmado para {criança} na sala {sala}." — sem linha do código.
- **Professor/Líder (KidsDashboard)**: some o botão "Ver código". Cada criança tem só o botão **"Check-out"**, que abre uma confirmação simples ("Confirmar retirada de {nome}?") e libera.

## Arquivos e mudanças

### Frontend
- `src/pages/kids/KidsCheckin.tsx`: remover exibição do `pickup_code` (bloco verde com os 4 dígitos) e da coluna `code` no `setResults`.
- `src/pages/kids/KidsDashboard.tsx`: remover botão "Ver código"/"EyeOff", estado `reveal`, campo `pickup_code` do tipo `ActiveChild`. Trocar o diálogo de check-out por um `AlertDialog` simples de confirmação.
- `supabase/functions/kids-notify-whatsapp/index.ts`: remover a linha do código no template de check-in.

### Backend (migração SQL)
- Alterar `public.kids_perform_checkout(_checkin_id uuid)` — remove o parâmetro `_pickup_code` e a verificação `IF v_stored <> _pickup_code`. Continua validando permissão do professor/líder e marca `checkout_at = now()`.
- Alterar `public.kids_perform_checkin_static` e `public.kids_perform_checkin_by_page` — parar de gerar/retornar `pickup_code` (insere string vazia ou removemos da coluna).
- Tornar `kids_checkins.pickup_code` opcional: `ALTER COLUMN pickup_code DROP NOT NULL` e default `''`. Preserva o histórico já existente sem quebrar consultas antigas.
- Regenerar `src/integrations/supabase/types.ts` (automático após a migração).

## Não muda
- Fluxo de cadastro dos pais, atribuição automática por idade, QR único, janela de check-in, transferência entre salas, badges "Check-in ativo/Aguardando" no admin.
- Coluna `pickup_code` continua existindo na tabela para não perder registros históricos; só deixa de ser exigida.

## Detalhes técnicos
- Assinatura antiga do RPC (`_checkin_id`, `_pickup_code`) é substituída — o único chamador no frontend é `KidsDashboard.performCheckout`, que será ajustado para passar apenas `_checkin_id`.
- A migração usa `CREATE OR REPLACE FUNCTION` para as três funções afetadas, mantendo `SECURITY DEFINER` e `search_path = public` já existentes.