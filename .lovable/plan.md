# Mensagem de Apoio Automática via WhatsApp a cada 15 dias

## Objetivo

Criar uma Edge Function que envia automaticamente uma mensagem de apoio ao projeto Levi com as informações do PIX para todos os usuarios que possuem numero de WhatsApp cadastrado, executada a cada 15 dias via cron job.

## O que sera feito

### 1. Nova Edge Function: `send-support-whatsapp`

- Busca todos os perfis (`profiles`) que possuem campo `whatsapp` preenchido
- Envia uma mensagem formatada com:
  - Agradecimento pelo uso do Levi
  - Chave PIX: `suport@leviescalas.com.br`
  - Nome do titular: EDUARDO LINO DA SILVA
  - Valor sugerido: R$ 10,00
  - Link para a pagina de apoio: `https://leviescalas.lovable.app/apoio`
- Utiliza a Edge Function existente `send-whatsapp-notification` para o disparo individual
- Registra log de quantos envios foram feitos

### 2. Cron Job (pg_cron + pg_net)

- Agenda a execucao da function a cada 15 dias
- Expressao cron: `0 12 1,16 * *` (dias 1 e 16 de cada mes, ao meio-dia horario de Brasilia)

### 3. Configuracao

- Adicionar entrada `[functions.send-support-whatsapp]` no `config.toml` com `verify_jwt = false`

## Detalhes Tecnicos

### Mensagem enviada

```text
❤️ *Apoie o Levi - Escalas Inteligentes* ❤️

Ola! Obrigado por usar o Levi para organizar suas escalas.

O Levi e gratuito e mantido com o apoio de pessoas como voce. Se puder contribuir com qualquer valor, ajuda muito a manter o projeto no ar!

💰 *Chave PIX (E-mail):*
suport@leviescalas.com.br

👤 *Titular:* EDUARDO LINO DA SILVA

🔗 Veja mais em: https://leviescalas.lovable.app/apoio

Deus abencoe! 🙏
```

### Cron SQL (executado via insert tool)

```sql
SELECT cron.schedule(
  'send-support-whatsapp-biweekly',
  '0 15 1,16 * *',
  $$ SELECT net.http_post(
    url:='https://zuksvsxnchwskqytuxxq.supabase.co/functions/v1/send-support-whatsapp',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGci..."}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id; $$
);
```

Nota: Horario 15:00 UTC = 12:00 Brasilia.

### Arquivos modificados/criados

- **Novo**: `supabase/functions/send-support-whatsapp/index.ts`
- **Editado**: `supabase/config.toml` (adicionar entrada da nova function)
- **SQL via insert tool**: cron job agendado