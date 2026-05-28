## Mudanças no fluxo de apoio/doação

### 1. Botão "Apoiar via cartão" → Stripe Payment Link
- Em `src/pages/Payment.tsx`: substituir o card de "Cartão de Crédito/Débito" (que hoje chama a edge function `create-donation-checkout` com valor digitado) por um botão simples que abre `https://donate.stripe.com/9B63cw3ekcsy2wG6dw4AU00` em nova aba.
- Remover o input de valor, o estado `cardAmount`, `loadingCheckout` e a função `handleStripeCheckout`.
- A edge function `create-donation-checkout` deixa de ser usada por este fluxo (mantida no projeto, sem remoção, para não quebrar nada que ainda possa referenciá-la).

### 2. Nova chave PIX
- Substituir a constante `PIX_KEY` em:
  - `src/pages/Payment.tsx`
  - `src/pages/SupportPix.tsx`
- De: `suport@leviescalas.com.br`
- Para: `leviescalas@gmail.com`
- Atualizar o rótulo "Chave PIX (E-mail)" — continua e-mail, ok.
- Adicionar informação do banco: **Banco BMG** abaixo do titular **EDUARDO LINO DA SILVA** nos dois arquivos.

### 3. Remover QR Code antigo
- Remover a imagem `pixQrCode` (import e `<img src={pixQrCode} />`) de:
  - `src/pages/Payment.tsx`
  - `src/pages/SupportPix.tsx`
- O QR atual aponta para a chave antiga; sem QR novo informado pelo usuário, exibimos apenas a chave PIX em destaque com botão "Copiar chave PIX".
- Arquivo `src/assets/pix-qrcode-levi.jpg` permanece no repositório (não deletar) mas deixa de ser referenciado.

### 4. Botão "Apoiar via cartão" no SupportPix
- Em `src/pages/SupportPix.tsx`, o botão "Pagar com cartão" hoje navega para `/payment`. Trocar para abrir o Payment Link do Stripe diretamente em nova aba (consistência com o item 1).

### Não incluído
- Não mexer em backend/edge functions, nem em RLS/DB.
- Não tocar em outras telas além de Payment.tsx e SupportPix.tsx.

Confirma que posso seguir? Se você tiver um **QR code novo** da chave `leviescalas@gmail.com` (BMG), me envie a imagem que eu coloco no lugar — caso contrário sigo apenas com a chave PIX em texto + botão copiar.