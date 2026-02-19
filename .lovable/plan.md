

## Enviar Avisos do Mural via Telegram + Verificar Push

### O que sera feito

**1. Adicionar Telegram aos avisos do mural**

Quando um lider publica um aviso, alem da notificacao in-app e push (que ja existem), o sistema tambem enviara a mensagem via Telegram para cada membro que tiver o bot vinculado.

**2. Verificar push notifications**

Os logs mostram que a funcao `send-announcement-notification` nunca foi chamada ainda. Isso significa que nenhum aviso foi publicado desde que a funcao foi criada. Apos a implementacao, podemos testar publicando um aviso e verificando os logs.

### Comportamento esperado

Ao publicar um aviso no mural:
- Notificacao in-app (ja funciona)
- Push via WonderPush (ja funciona)
- **Telegram** para membros com bot vinculado (novo)

Membros sem Telegram vinculado simplesmente nao recebem por esse canal -- sem erro.

### Secao Tecnica

**Arquivo: `supabase/functions/send-announcement-notification/index.ts`**

Adicionar uma funcao `sendTelegramNotification` que, para cada membro, chama a edge function `send-telegram-notification` ja existente. A mensagem no Telegram seguira o formato:

```text
📢 *Aviso - [Nome do Departamento]*

[Titulo do aviso]
```

Alteracoes especificas:
1. Criar funcao helper `sendTelegramNotification(supabaseUrl, serviceRoleKey, userId, message)` que chama `send-telegram-notification`
2. Apos o envio de push, iterar sobre `memberIds` e chamar a funcao de Telegram para cada um (em paralelo com `Promise.allSettled`)
3. Logar quantos foram enviados com sucesso

**Arquivos alterados:**
- `supabase/functions/send-announcement-notification/index.ts`

