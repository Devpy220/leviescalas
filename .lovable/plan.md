

## Atualizar QR Code PIX de Apoio

### Resumo
Existe apenas **1 QR Code de apoio PIX** no projeto, localizado em `src/assets/pix-qrcode-levi.jpg` e usado na pagina `src/pages/Payment.tsx`. Os outros QR codes encontrados sao de funcionalidades diferentes (convite de membros e autenticacao 2FA) e nao serao alterados.

### Mudancas

1. **Substituir a imagem do QR Code**
   - Copiar a nova imagem enviada (`qrcodelevi.jpeg`) para `src/assets/pix-qrcode-levi.jpg`, sobrescrevendo a antiga
   - O import em `Payment.tsx` continuara funcionando sem alteracao de codigo

### Resultado
A pagina de Apoio (`/apoio`) passara a exibir o novo QR Code oficial do PIX imediatamente.

