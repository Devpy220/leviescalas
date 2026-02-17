

# Corrigir Notificações Push - API WonderPush

## Problema Identificado

O codigo atual chama metodos diretamente no objeto `window.WonderPush` (ex: `wp.setUserId(...)`, `wp.subscribeToNotifications()`), mas o WonderPush SDK usa um **sistema de fila de comandos**. O `window.WonderPush` e um array, nao o SDK em si. Por isso os metodos nao existem e o botao nao funciona.

A API correta usa `WonderPush.push(...)` para enviar comandos:
- `WonderPush.push(['setUserId', 'id'])` 
- `WonderPush.push(['subscribeToNotifications'])`
- Para valores de retorno: `WonderPush.push(function() { WonderPush.isSubscribedToNotifications().then(...) })`

## Solucao

Reescrever `src/hooks/usePushNotifications.tsx` para usar a API correta do WonderPush.

### Mudancas

**Arquivo: `src/hooks/usePushNotifications.tsx`**

1. Substituir a funcao `waitForWonderPush` por uma que resolva com o SDK real (via callback dentro do `push`)
2. Usar a API de fila correta:
   - `WonderPush.push(['setUserId', user.id])` em vez de `wp.setUserId(user.id)`
   - `WonderPush.push(['subscribeToNotifications'])` em vez de `wp.subscribeToNotifications()`
   - Para leitura de status, usar callback: `WonderPush.push(function() { ... })`
3. Manter a logica de auto-subscribe no login
4. Manter a logica de subscribe/unsubscribe manual no toggle

### Detalhes Tecnicos

A funcao helper ficara assim:

```text
function wonderPushReady(): Promise<void> {
  return new Promise((resolve) => {
    window.WonderPush = window.WonderPush || [];
    window.WonderPush.push(function() {
      resolve();
    });
  });
}
```

Apos `wonderPushReady()`, o SDK esta carregado e podemos chamar metodos diretamente em `window.WonderPush` (que nesse ponto ja foi substituido pelo SDK real). Portanto:

```text
await wonderPushReady();
window.WonderPush.push(['setUserId', user.id]);
const subscribed = await window.WonderPush.isSubscribedToNotifications();
```

Isso corrige o problema do botao nao funcionar e garante que a auto-inscricao ocorra corretamente no login.

