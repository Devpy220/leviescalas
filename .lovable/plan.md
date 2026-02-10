
# Corrigir Loop de Login -- Navegacao Direta para "Minha Escala"

## Problema

O fluxo atual tem uma **corrida de estado (race condition)**:

1. `Auth.tsx` faz `signIn()`, recebe a sessao, e chama `navigate('/dashboard')` imediatamente.
2. O `AuthProvider` ainda nao processou o evento `onAuthStateChange` -- entao `user` e `session` no React ainda sao `null`.
3. `ProtectedRoute` nao encontra usuario, espera 300ms, tenta `ensureSession`, mas as vezes o timeout de 5s redireciona de volta para `/auth`.
4. `/auth` detecta sessao valida e redireciona de volta para `/dashboard` -- **loop infinito no spinner**.

O delay de 200ms no `handleLogin` nao e suficiente para garantir que o `AuthProvider` ja atualizou o estado React.

## Solucao

A correcao envolve **duas mudancas coordenadas**:

### 1. Auth.tsx -- Aguardar o estado React hidratar de verdade

Em vez de um `setTimeout(200ms)` fixo (que pode nao ser suficiente), o `handleLogin` vai **aguardar ativamente** ate que o `user` esteja disponivel no contexto React, com um timeout maximo de 3 segundos.

```text
Fluxo atual:
  signIn() -> sleep(200ms) -> navigate()
  
Fluxo novo:
  signIn() -> poll ate user != null (max 3s, check a cada 50ms) -> navigate()
```

Implementacao: criar uma funcao `waitForAuthHydration` que retorna uma Promise resolvida quando o `onAuthStateChange` disparar `SIGNED_IN`. Isso usa o proprio listener do Supabase para saber o momento exato.

### 2. ProtectedRoute -- Aceitar sessao do Supabase diretamente

O `ProtectedRoute` atualmente so confia no estado React (`user`/`session`). Se eles estiverem `null` por causa de um atraso na hidratacao, ele redireciona.

A mudanca: antes de redirecionar para `/auth`, o `ProtectedRoute` vai chamar `supabase.auth.getSession()` diretamente (sem depender do React state). Se encontrar uma sessao valida, marca como verificado e atualiza o contexto.

Isso elimina a janela onde o React state esta vazio mas a sessao ja existe no storage do navegador.

### 3. Garantir navegacao para "Minha Escala" (my-schedules)

O `getSmartRedirectDestination` ja redireciona para `/my-schedules` quando o usuario tem exatamente 1 departamento. A correcao do loop garante que esse redirecionamento funcione sem interrupção.

## Detalhes Tecnicos

### Arquivo: `src/pages/Auth.tsx`

- Substituir o `await new Promise(resolve => setTimeout(resolve, 200))` (linha 422) por uma funcao que escuta `onAuthStateChange` para o evento `SIGNED_IN`:

```typescript
const waitForAuthHydration = (timeoutMs = 3000): Promise<void> => {
  return new Promise((resolve) => {
    // Se ja tem user no contexto, resolve imediatamente
    if (user) { resolve(); return; }
    
    const timeout = setTimeout(resolve, timeoutMs);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        clearTimeout(timeout);
        subscription.unsubscribe();
        // Pequeno delay para o React processar o setState
        setTimeout(resolve, 50);
      }
    });
    
    // Cleanup em caso de timeout
    setTimeout(() => subscription.unsubscribe(), timeoutMs + 100);
  });
};
```

- Chamar `await waitForAuthHydration()` no lugar do sleep de 200ms.

### Arquivo: `src/components/ProtectedRoute.tsx`

- No bloco de recovery (quando `currentUser` e `null` e `authLoading` e `false`), antes de redirecionar, fazer um check sincrono direto:

```typescript
// Antes de redirecionar, verificar se a sessao existe no storage
const { data } = await supabase.auth.getSession();
if (data.session?.user) {
  setVerified(true);
  return; // Sessao existe, so falta o React hidratar
}
// Agora sim, redireciona para /auth
```

- Remover o delay de 300ms antes do `ensureSession` (nao e mais necessario com a verificacao direta).

## Resultado Esperado

1. Usuario faz login
2. `handleLogin` espera ate o AuthProvider processar a sessao (~50-100ms, nao 200ms fixo)
3. Navega para `/my-schedules` (se 1 departamento) ou `/dashboard`
4. `ProtectedRoute` encontra o usuario imediatamente -- sem loop
5. Se por algum motivo o React state atrasar, o `ProtectedRoute` verifica direto no storage e aceita a sessao
