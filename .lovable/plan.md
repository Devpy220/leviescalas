
## Plano de Correção: Loop ao Logar 

### Diagnóstico do Problema

O loop acontece por causa de uma **corrida de condições** entre três componentes:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Auth.tsx: handleLogin()                                             │
│     └─ Faz login com sucesso                                            │
│     └─ Chama getSmartRedirectDestination() → retorna "/my-schedules"    │
│     └─ navigate("/my-schedules") ← PROBLEMA: navega antes do React      │
│        atualizar user/session no contexto                               │
├─────────────────────────────────────────────────────────────────────────┤
│  2. ProtectedRoute em /my-schedules                                     │
│     └─ Verifica user/session ← ainda NULL porque o estado React         │
│        não sincronizou ainda                                            │
│     └─ Tenta ensureSession() mas isso também demora                     │
│     └─ Redireciona para /auth com returnUrl no state                    │
├─────────────────────────────────────────────────────────────────────────┤
│  3. Auth.tsx (novamente)                                                │
│     └─ Agora a sessão existe                                            │
│     └─ useEffect detecta sessão → redireciona                           │
│     └─ MAS não lê returnUrl do state! Vai para /dashboard               │
│     └─ Ciclo pode recomeçar...                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Causas Raiz

1. **`handleLogin` navega muito cedo**: O login é feito via Supabase API, mas o estado React (`user`/`session`) no `AuthProvider` ainda não atualizou quando `navigate()` é chamado.

2. **Falta de sincronização**: O `signIn` retorna a `session` diretamente, mas não espera o `onAuthStateChange` propagar para o contexto React.

3. **`Auth.tsx` ignora `returnUrl`**: Quando o usuário é mandado de volta para `/auth` pelo `ProtectedRoute`, o `returnUrl` está no `location.state`, mas o useEffect de "já autenticado" não usa isso.

---

### Correções Propostas

#### A) Aguardar hidratação do contexto React após login

**Arquivo: `src/pages/Auth.tsx`**

No `handleLogin`, após `signIn` retornar com sucesso, precisamos aguardar que o `onAuthStateChange` dispare e atualize o estado React antes de navegar. Isso evita que o `ProtectedRoute` veja um estado "vazio".

**Modificação**:
- Adicionar uma pequena espera (100-200ms) após o `signIn` retornar, para dar tempo ao `onAuthStateChange` atualizar o contexto
- Ou, verificar se o `user` do contexto está disponível antes de navegar

#### B) Respeitar `returnUrl` do location.state

**Arquivo: `src/pages/Auth.tsx`**

O useEffect que redireciona usuários já autenticados (linhas 218-269) precisa verificar se existe um `returnUrl` no `location.state` e usá-lo como prioridade sobre a lógica de smart redirect.

**Modificação**:
```typescript
// Antes de chamar getSmartRedirectDestination:
const stateReturnUrl = (location.state as any)?.returnUrl;
if (stateReturnUrl && stateReturnUrl.startsWith('/')) {
  navigate(stateReturnUrl, { replace: true, state: {} });
  return;
}
```

#### C) Prevenir navegação duplicada

**Arquivo: `src/pages/Auth.tsx`**

O `hasRedirectedRef` já existe, mas pode não estar sendo respeitado em todos os caminhos. Precisamos garantir que ele seja setado ANTES de qualquer `navigate()`.

---

### Implementação Detalhada

#### 1. `src/pages/Auth.tsx` - handleLogin (linhas 369-439)

**Problema**: Navega imediatamente após login sem esperar o contexto React.

**Solução**: Adicionar uma espera para garantir que o `user` no contexto React seja atualizado:

```typescript
// Após o login bem-sucedido, aguardar o contexto React sincronizar
// Isso evita que ProtectedRoute veja um estado vazio
await new Promise(resolve => setTimeout(resolve, 200));
```

#### 2. `src/pages/Auth.tsx` - useEffect de redirecionamento (linhas 218-269)

**Problema**: Não usa o `returnUrl` do `location.state`.

**Solução**: Verificar `location.state` antes de calcular destino:

```typescript
// Verificar se existe returnUrl no state (vindo do ProtectedRoute)
const stateReturnUrl = (location.state as any)?.returnUrl;
if (stateReturnUrl && stateReturnUrl.startsWith('/')) {
  navigate(stateReturnUrl, { replace: true, state: {} });
  return;
}
```

#### 3. `src/pages/Auth.tsx` - Prevenir múltiplos caminhos de navegação

Garantir que `hasRedirectedRef.current = true` seja setado no início de QUALQUER bloco que chama `navigate()`, não apenas no useEffect.

---

### Arquivos a Serem Alterados

1. **`src/pages/Auth.tsx`**
   - `handleLogin`: Adicionar delay de sincronização após login
   - `handle2FASuccess`: Adicionar delay de sincronização após 2FA
   - useEffect de redirecionamento: Verificar `location.state.returnUrl`
   - Garantir que `hasRedirectedRef` seja consistentemente usado

---

### Validação

1. **Teste de Login Normal**:
   - Deslogar completamente
   - Entrar com usuário que tem 1 departamento
   - Deve ir direto para `/my-schedules` SEM loop

2. **Teste de Login com 0 departamentos**:
   - Entrar com usuário sem departamentos
   - Deve ir para `/dashboard` SEM loop

3. **Teste de Retorno**:
   - Acessar `/my-schedules` diretamente sem sessão
   - Fazer login
   - Deve voltar para `/my-schedules` (returnUrl)
