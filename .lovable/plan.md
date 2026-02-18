

## Manter Notificacoes Push Ativas entre Logins

### Problema
Toda vez que voce faz login, o toggle de notificacoes push aparece como desativado porque o sistema depende do SDK do WonderPush carregar para verificar o estado. Se o SDK demora, o toggle mostra "desativado" mesmo que as notificacoes ja estejam ativas.

### Solucao
Salvar o estado de inscricao no localStorage do navegador. Quando voce fizer login, o sistema vai:
1. Ler o estado salvo localmente e mostrar o toggle correto imediatamente
2. Confirmar com o SDK em segundo plano (sem bloquear a interface)
3. Se a permissao ja estiver concedida, reinscrever automaticamente sem precisar de acao manual

### Comportamento esperado
- Login -> toggle ja aparece ativo (se estava ativo antes)
- Nenhuma acao manual necessaria
- Se por algum motivo a inscricao foi perdida no servidor, o sistema reinscreve sozinho em segundo plano

### Secao Tecnica

**Arquivo: `src/hooks/usePushNotifications.tsx`**

1. Adicionar constante `PUSH_SUBSCRIBED_KEY = 'levi_push_subscribed'`

2. No estado inicial de `isSubscribed`, ler do localStorage:
   ```text
   const [isSubscribed, setIsSubscribed] = useState(() => {
     return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === 'true';
   });
   ```

3. Criar wrapper `setIsSubscribedPersisted` que salva no localStorage ao alterar:
   ```text
   const setIsSubscribedPersisted = (value: boolean) => {
     setIsSubscribed(value);
     localStorage.setItem(PUSH_SUBSCRIBED_KEY, String(value));
   };
   ```

4. Substituir todas as chamadas `setIsSubscribed(...)` por `setIsSubscribedPersisted(...)` em:
   - `syncWonderPush` (efeito de sync com login)
   - `subscribe` (funcao de ativar)
   - `unsubscribe` (funcao de desativar)

5. No efeito `syncWonderPush`, quando `Notification.permission === 'granted'` e o localStorage indica inscrito, forcar resubscribe silencioso mesmo que `wpIsSubscribed()` retorne `false` (reconecta automaticamente).

**Arquivos alterados:**
- `src/hooks/usePushNotifications.tsx`

