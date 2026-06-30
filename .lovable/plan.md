
# Migração para Cakto Pay + Faxina de integrações

## 1. Cakto Pay (apoio único + assinatura recorrente)

**Backend (edge functions)**
- `_shared/cakto.ts` — cliente OAuth2 (cache de access_token), helpers `createCheckout` e `verifyWebhookSignature` usando `CAKTO_WEBHOOK_SECRET`.
- `cakto-setup` — função admin chamada uma vez para criar/atualizar os 2 produtos na Cakto (Apoio único e Assinatura mensal) e registrar o webhook apontando para `cakto-webhook`. Guarda IDs em uma tabela `cakto_products`.
- `cakto-create-payment` — pública, recebe `{ amount, mode: "one_time" | "subscription", payment_method: "pix" | "credit_card", donor_name?, donor_email? }`, valida com Zod, gera checkout Cakto e devolve `{ url }`. Allowlist de Origin (mesma usada no Stripe).
- `cakto-webhook` — pública (sem JWT), valida assinatura HMAC com `CAKTO_WEBHOOK_SECRET`, atualiza `donations` (status pago/falhou/cancelado) e dispara WhatsApp de agradecimento via UAZAPI quando houver telefone.

**Banco de dados (1 migração)**
- `cakto_products(kind, cakto_product_id, cakto_price_id, amount_cents)` — admin-only.
- `donations(donor_name, donor_email, donor_whatsapp, amount_cents, mode, payment_method, status, cakto_session_id, cakto_subscription_id, paid_at)` — insert público via edge function; SELECT só admin.
- Remover colunas `stripe_customer_id`, `stripe_subscription_id` de `departments` e funções `get_department_secure`/`get_department_full` (regerar sem essas colunas).
- Remover tabela `payment_receipts` se realmente não usada (verifico antes; caso contrário, mantenho).

**Frontend**
- `src/pages/Apoiar.tsx` (renomeio do antigo Apoiar/SupportPix) com tabs **Doação única** / **Assinatura mensal**, valores pré-definidos (10, 25, 50, 100, livre), seleção PIX / Cartão e botão único que chama `cakto-create-payment`.
- Atualizar todos os CTAs e mensagens WhatsApp para apontar para `/apoiar` (já apontam — só conferir).
- Remover `Payment.tsx`, `PaymentSuccess.tsx`, `SupportPix.tsx` (se não usados após migração).

## 2. Faxina de integrações mortas

**Edge functions removidas**: nenhuma específica do Stripe existe além de `create-donation-checkout` e `update-subscription-quantity` — ambas serão deletadas. Não há funções Twilio/Telegram/Push/SMSDev/Fiqon.

**Secrets deletados**: `STRIPE_SECRET_KEY`, `TWILIO_*` (3), `TELEGRAM_BOT_TOKEN`, `WONDERPUSH_*` (2), `PUSHALERT_API_KEY`, `VAPID_*` (5), `SMSDEV_API_KEY`, `FIQON_WEBHOOK_URL`.

**Tabelas/colunas removidas**: `telegram_link_codes`, `telegram_links`, `push_subscriptions`, `pushalert_subscribers`. Colunas Stripe em `departments` (acima).

**Código frontend removido**: qualquer import/uso de Push/Telegram/Stripe restante (vou varrer com `rg` e apagar componentes mortos).

## 3. Ordem de execução

1. Migração DB (cria tabelas Cakto + remove colunas/tabelas legadas).
2. Edge functions Cakto (setup, create-payment, webhook).
3. Frontend `/apoiar` reescrito.
4. Faxina: delete de funções, arquivos, secrets.
5. Você roda **Disparar setup Cakto** (botão no Admin) → cria produtos e webhook.
6. Teste rápido: doação única PIX + assinatura cartão.

## Detalhes técnicos

- API Cakto: OAuth2 client credentials em `https://api.cakto.com.br/oauth/token`; checkout em `POST /v1/checkouts`. Webhook envia header `X-Cakto-Signature` = HMAC-SHA256(body, secret).
- Webhook precisa estar publicado **antes** do `cakto-setup` rodar (URL: `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/cakto-webhook`).
- `verify_jwt = false` no `cakto-webhook` e `cakto-create-payment` (público).

Confirma para eu começar pela migração?
