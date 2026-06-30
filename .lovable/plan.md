# Plano: Migrar para Cakto Pay + Faxina de Integrações

## 1. O que você precisa fornecer (1 vez só)

A Cakto usa **OAuth2** com `client_id` + `client_secret` que você gera no painel:
👉 https://app.cakto.com.br/dashboard/cakto-api

Vou pedir via `add_secret` (formulário seguro) DEPOIS deste plano ser aprovado:
- `CAKTO_CLIENT_ID`
- `CAKTO_CLIENT_SECRET`
- `CAKTO_WEBHOOK_SECRET` (você define ao criar o webhook — pode ser uma string aleatória)

**Você NÃO precisa criar produto/link no painel** — vou criar via API.

## 2. O que vou criar via API da Cakto

Edge function `cakto-setup` (executada 1 vez por você, botão no Admin):
- Cria **2 produtos** automaticamente:
  - "Apoio LEVI — Avulso" (oferta única, R$ 25 sugerido, PIX + cartão)
  - "Apoio LEVI — Mensal" (assinatura, R$ 25/mês, PIX recorrente + cartão)
- Cria **webhook** apontando para `https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/cakto-webhook` com o `CAKTO_WEBHOOK_SECRET`
- Salva IDs retornados em `app_settings` (nova tabela kv simples)

## 3. Edge functions novas

| Função | Papel |
|---|---|
| `cakto-setup` | Roda 1x, cria produtos + webhook |
| `cakto-create-payment` | Recebe `{type: "once"\|"subscription", amount}`, retorna `checkout_url` (ou QR PIX direto) |
| `cakto-webhook` | Recebe eventos `purchase.approved`, `subscription.created`, etc. Valida assinatura. Loga em `payment_receipts`. |

## 4. Frontend — apoio (`/apoiar` e `/payment`)

- `/payment` (interno Stripe) → **removida**
- `/apoiar` (`SupportPix.tsx`) vira a única tela de apoio com 3 ações:
  - **Apoio único** → botão "Pagar R$ 25 (ou outro valor)" → abre Checkout Cakto em nova aba
  - **Apoio mensal (PIX/cartão)** → botão "Apoiar todo mês" → abre Checkout assinatura Cakto
  - **PIX manual** (chave copy/paste) — mantém como fallback
- Mantém R$ 25 como sugestão padrão; campo editável.
- Links em mensagens WhatsApp (`messageVariants.ts`) trocados para `/apoiar`.

## 5. Faxina (remoções)

### Edge functions removidas
- `create-donation-checkout` (Stripe)
- `update-subscription-quantity` (Stripe — planos de igreja não usam mais)
- `send-telegram-notification`, `setup-telegram-webhook`, `telegram-webhook`
- `send-push-notification`

### Tabelas/colunas (migração SQL)
- Drop colunas `stripe_customer_id`, `stripe_subscription_id`, `trial_ends_at` de `departments` (se aceito)
- Drop tabelas: `push_subscriptions`, `pushalert_subscribers`, `telegram_links`, `telegram_link_codes`
- Atualizar funções `get_department_secure`, `get_department_full`, `log_billing_access` para remover refs a stripe

### Páginas/componentes removidos
- `src/pages/Payment.tsx`, `src/pages/PaymentSuccess.tsx` (substituídos por `/apoiar/sucesso` simples)
- Qualquer card no `DepartmentSettingsDialog` relacionado a assinatura Stripe

### Secrets para apagar
`STRIPE_SECRET_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TELEGRAM_BOT_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_D`, `VAPID_X`, `VAPID_Y`, `WONDERPUSH_APPLICATION_ID`, `WONDERPUSH_ACCESS_TOKEN`, `PUSHALERT_API_KEY`, `SMSDEV_API_KEY`

Mantidos: UAZAPI_*, RESEND_API_KEY, CRON_SECRET, LOVABLE_API_KEY, PAGESPEED_API_KEY, FIQON_WEBHOOK_URL, GOOGLE_SEARCH_CONSOLE_API_KEY.

## 6. Validação final

- Build/typecheck.
- Botão "Apoiar" abre checkout Cakto real (sandbox primeiro, se você tiver).
- Webhook recebe e grava em `payment_receipts`.
- Confirmar via Admin que nenhum import órfão sobrou (Telegram/Push/Stripe).

## Detalhes técnicos

- Auth Cakto: `POST /oauth/token` com `grant_type=client_credentials`, cachear `access_token` por TTL no `app_settings`.
- PIX recorrente: Cakto chama "Assinatura" com `payment_method=pix` na oferta — gera novo QR a cada ciclo, notifica via webhook.
- Validação webhook: header `X-Cakto-Signature` (HMAC-SHA256 com `CAKTO_WEBHOOK_SECRET`).
- Sem código Stripe restante; remoção de `npm:stripe` do `import_map` das funções.

---

**Confirme o plano** e em seguida abro o formulário seguro pra você colar `CAKTO_CLIENT_ID` e `CAKTO_CLIENT_SECRET`. Depois rodo tudo na sequência.