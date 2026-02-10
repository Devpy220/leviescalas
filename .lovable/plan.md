

# Simplificar Pagamento para Apenas PIX + Banner Rotativo "Apoie o Levi"

## Resumo

1. Substituir o QR code atual pelo QR code real enviado pelo usuario
2. Remover todas as formas de pagamento Stripe (edge functions: `create-support-checkout`, `create-checkout`, `customer-portal`, `check-subscription`, `complete-checkout`)
3. Substituir o `SupportNotification` (modal popup) por um banner tipo "marquee" que percorre a tela a cada 2 dias com o texto "Apoie o Levi com qualquer valor, clique aqui" e ao clicar navega para `/apoio`
4. Limpar referencias ao Stripe/checkout em `MySchedules.tsx` e outros componentes

## Mudancas Detalhadas

### 1. Substituir QR Code PIX

Copiar a imagem enviada (`WhatsApp_Image_2026-02-10_at_11.42.02.jpeg`) para `src/assets/pix-qrcode-levi.jpg`, substituindo o placeholder atual.

### 2. Remover Edge Functions de Stripe

Deletar as seguintes edge functions que nao serao mais usadas:
- `supabase/functions/create-support-checkout/` - checkout Stripe para apoio
- `supabase/functions/create-checkout/` - checkout Stripe geral
- `supabase/functions/customer-portal/` - portal do cliente Stripe
- `supabase/functions/check-subscription/` - verificacao de assinatura
- `supabase/functions/complete-checkout/` - finalizacao de checkout

Atualizar `supabase/config.toml` para remover as entradas dessas funcoes.

### 3. Reescrever SupportNotification como Banner Marquee

**Arquivo: `src/components/SupportNotification.tsx`**

Substituir o modal popup atual por um banner animado (marquee/ticker) que:
- Aparece a cada 2 dias (verifica localStorage pela ultima vez que foi mostrado)
- Exibe uma faixa na parte inferior da tela com texto animado deslizando: "Apoie o Levi com qualquer valor, clique aqui"
- Ao clicar, navega para `/apoio` (pagina de pagamento PIX)
- Pode ser fechado com X e registra no localStorage
- Usa animacao CSS `@keyframes marquee` para o efeito de texto percorrendo
- Remove toda dependencia do Stripe (`supabase.functions.invoke`, `SUPPORT_PRICE_ID`)

### 4. Limpar MySchedules.tsx

- Remover `handleSupportLevi` (usa `create-support-checkout`)
- Remover `SupportPlan` interface e estado `supportPlan`
- Remover import de `SUPPORT_PRICE_ID`
- Substituir o botao "Apoiar Agora" (que chamava Stripe) por um link simples para `/apoio`

### 5. Limpar constants.ts

- Remover `SUPPORT_PRICE_ID` de `src/lib/constants.ts`

### 6. Limpar DepartmentSettingsDialog.tsx

- Remover referencia a `customer-portal` edge function

## Arquivos a modificar/deletar

| Arquivo | Acao |
|---------|------|
| `src/assets/pix-qrcode-levi.jpg` | Substituir pelo QR code real |
| `src/components/SupportNotification.tsx` | Reescrever como banner marquee a cada 2 dias |
| `src/pages/MySchedules.tsx` | Remover logica Stripe, simplificar botao apoio |
| `src/lib/constants.ts` | Remover `SUPPORT_PRICE_ID` |
| `src/components/department/DepartmentSettingsDialog.tsx` | Remover referencia ao customer-portal |
| `supabase/functions/create-support-checkout/` | Deletar |
| `supabase/functions/create-checkout/` | Deletar |
| `supabase/functions/customer-portal/` | Deletar |
| `supabase/functions/check-subscription/` | Deletar |
| `supabase/functions/complete-checkout/` | Deletar |
| `supabase/config.toml` | Remover entradas das funcoes deletadas |

