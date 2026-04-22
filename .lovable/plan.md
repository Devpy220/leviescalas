## Adicionar botão "Copiar chave PIX" nas mensagens de apoio via WhatsApp

WhatsApp não suporta botões interativos em mensagens de texto comum via Z-API. Para permitir que o usuário copie a chave PIX com um clique, vou criar uma **landing page dedicada** com botão de cópia, e a mensagem do WhatsApp incluirá o link curto para essa página (além de manter a chave em texto para fallback).

### Mudanças

**1. Nova rota pública `/apoiar` (`src/pages/SupportPix.tsx`)**

- Página leve (sem sidebar/auth) com:
  - Logo LEVI + título "Apoie o Projeto"
  - Card com QR Code PIX (reusa `pixQrCode`)
  - Chave PIX em destaque + **botão grande "Copiar chave PIX"** (usa `navigator.clipboard` + toast "Copiado!")
  - Nome do titular (EDUARDO LINO DA SILVA)
  - Botão secundário "Pagar com cartão" → redireciona para `/payment`
- Sem login necessário (acesso direto via WhatsApp)

**2. Registrar rota em `src/App.tsx**`

- Adicionar `<Route path="/apoiar" element={<SupportPix />} />` (pública)

**3. Atualizar `supabase/functions/_shared/messageVariants.ts**`

- Em `buildSupportMessage`, incluir o link `https://leviescalas.com.br/apoiar` como CTA principal:
  ```
  💛 Toque para copiar a chave PIX:
  👉 https://leviescalas.com.br/apoiar

  Ou copie manualmente:
  PIX: suport@leviescalas.com.br
  Titular: EDUARDO LINO DA SILVA
  ```
- Mantém a chave em texto para quem preferir copiar direto do WhatsApp.

### Arquivos

- **Criar**: `src/pages/SupportPix.tsx`
- **Editar**: `src/App.tsx` (nova rota pública)
- **Editar**: `supabase/functions/_shared/messageVariants.ts` (adicionar link na mensagem de apoio)

### Observação

Veja se este link vai funcionar pois será que a meta/whatsapp não banir o meu whatsapp, e o ultimo link não abria nada  verificar deixar link publico 

&nbsp;

O sistema de envio (cron dia 5 e 20 às 14h, queue + delays 10–180s + delayTyping) permanece intacto — apenas o conteúdo do texto muda.