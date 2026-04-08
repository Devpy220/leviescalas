## Plano: Página de Checkout Stripe com valor livre

### Resumo

Criar uma Edge Function que gera uma sessão de checkout do Stripe onde o **usuário define o valor** (sem preço fixo). Na página `/payment`, adicionar um campo de valor + botão que redireciona para o Stripe Checkout.

### Como funciona

O Stripe não permite `mode: "payment"` sem um `price`. A solução é usar `price_data` com o valor informado pelo usuário, criando um preço dinâmico por sessão.

### Etapas

**1. Criar Edge Function `create-donation-checkout**`

- Recebe `amount` (em centavos BRL) do frontend
- Valida valor mínimo (ex: R$ 1,00 = 100 centavos)
- Cria sessão Stripe Checkout com `price_data` dinâmico (moeda BRL, nome "Apoio voluntário")
- `mode: "payment"` (pagamento único)
- Não exige autenticação (qualquer pessoa pode doar)
- Retorna URL do checkout

**2. Atualizar página `/payment` (Payment.tsx)**

- Botão "Apoiar via cartão" que chama a Edge Function com o valor
- Redireciona para o Stripe Checkout em nova aba
- fazer uma alternativa de pix do stribe se tiver

**3. Criar página de sucesso `/payment-success**`

- Mensagem simples de agradecimento após pagamento bem-sucedido
- Botão para voltar ao dashboard

### Detalhes técnicos

- Edge Function: `supabase/functions/create-donation-checkout/index.ts`
- Stripe API: `stripe.checkout.sessions.create()` com `price_data` inline
- Moeda: BRL
- `STRIPE_SECRET_KEY` já está configurada nos secrets
- Sem webhook necessário