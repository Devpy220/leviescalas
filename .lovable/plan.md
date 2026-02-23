

## Correções no Fluxo de Recuperação de Senha

### Problemas Identificados

1. **Sessão de recuperação pode ser perdida durante o processo**: Quando o usuário clica no link de recuperação, o `useAuth` chama `ensureSession()` em paralelo com `exchangeCodeForSession()`. O `ensureSession` pode tentar um `refreshSession()` que invalida a sessão de recuperação recém-criada.

2. **Falta de logs para diagnóstico**: Não há logging suficiente no fluxo de reset para entender quando algo falha silenciosamente.

3. **O `signOut()` após redefinição pode causar confusão**: Após `updateUser({ password })`, o código chama `signOut()`. Mas se o `onAuthStateChange` disparar `TOKEN_REFRESHED` com sessão nula (que pode acontecer durante o signOut), o handler no `useAuth` redireciona para `/auth?expired=true`, mostrando "Sessão expirada" logo após o sucesso.

4. **Cache de sessão interfere no fluxo**: O `SESSION_CACHE_TTL` de 10 segundos pode servir uma sessão stale para o `performPasswordReset`, mascarando a perda real da sessão.

### Correções Propostas

**Arquivo: `src/pages/Auth.tsx`**

- Adicionar `console.log` detalhado em cada etapa do `performPasswordReset` para rastrear falhas
- Forçar `getSession` direto (sem cache) antes de `updateUser` usando `refreshSession()` para garantir sessão válida
- Usar `signOut({ scope: 'local' })` ao invés de `signOut()` completo para evitar conflitos com o handler de token
- Adicionar tratamento para o caso onde `updateUser` retorna sucesso mas a senha não é salva (verificação pós-reset)

**Arquivo: `src/hooks/useAuth.tsx`**

- Proteger o handler de `TOKEN_REFRESHED` com sessão nula para não redirecionar durante fluxo de recuperação ativo (verificar `window.location.pathname === '/auth'`)

### Detalhes Técnicos

**1. Melhorar `performPasswordReset` em Auth.tsx:**

```text
- Adicionar console.log antes e depois de updateUser
- Usar refreshSession() ao invés de getSession() para garantir token fresco
- Mudar signOut() para signOut({ scope: 'local' }) para evitar trigger do handler de token expirado
- Adicionar um pequeno delay (500ms) entre updateUser e signOut para garantir propagação
```

**2. Proteger handler de TOKEN_REFRESHED em useAuth.tsx:**

```text
- No bloco que trata TOKEN_REFRESHED + session nula (linhas ~262-271)
- Adicionar verificação: se pathname é '/auth', não forçar redirect
- Isso evita que o signOut do reset dispare o redirect de "sessão expirada"
```

**3. Melhorar feedback ao usuário:**

```text
- Se updateUser falhar, mostrar mensagem mais clara pedindo para solicitar novo link
- Se a sessão estiver ausente, oferecer botão para reenviar email de recuperação
```

