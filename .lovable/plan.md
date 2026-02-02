
## Diagnóstico (o porquê de ainda ir para `/dashboard` e do “loop na primeira vez”)

Pelos trechos atuais do `Auth.tsx`, existe um ponto que “puxa” o usuário para `/dashboard` mesmo quando a lógica inteligente decide `/my-schedules`:

1) **Auto-redirecionamento ao detectar sessão em `/auth`**  
No `Auth.tsx` existe este efeito:

- “Se já existe `session` e não é recovery e não está carregando, redireciona para `postAuthRedirect`”
- `postAuthRedirect` por padrão é **`/dashboard`**

Ou seja: em situações de timing (principalmente no primeiro login / primeiro carregamento do preview), o `session` pode ficar disponível e esse `useEffect` dispara e manda o usuário para `/dashboard` **antes**/em paralelo ao redirect inteligente.

2) **Primeiro carregamento do preview pode não “hidratar” a sessão rápido**  
No `AuthProvider` (useAuth), ele depende muito do `onAuthStateChange` para popular `session/user`. Em alguns ambientes (preview/iframe) pode haver atraso. O `ProtectedRoute` tenta “recuperar” e, se falhar/atrasar, redireciona para `/auth`, causando o “loop” na primeira vez. Depois de dar refresh, tudo fica “quente” e estabiliza, indo para `/dashboard`.

3) **A contagem de departamentos pode falhar se o token ainda não foi aplicado aos requests**  
Vocês já tentaram “delay” (200ms → 500ms), mas isso é frágil. O ideal é: **ter a sessão imediatamente disponível no estado** (sem depender do delay), ou usar uma função de backend para contar departamentos.

---

## Objetivo do ajuste

- Manter a regra:
  - **1 departamento → `/my-schedules`**
  - **0 ou 2+ departamentos → `/dashboard`**
- Eliminar o “loop no primeiro carregamento”
- Remover dependência de `setTimeout`/delay para que o token “propague”

---

## Mudanças propostas (código)

### A) `src/hooks/useAuth.tsx` — tornar o `signIn` “forte” e hidratar sessão imediatamente
1. Alterar a assinatura do `signIn` para retornar também a `session`:
   - De: `Promise<{ error: Error | null }>`
   - Para: `Promise<{ error: Error | null; session: Session | null }>` (e opcionalmente `user`)

2. Dentro do `signIn`, usar o retorno de `supabase.auth.signInWithPassword`:
   - `const { data, error } = await supabase.auth.signInWithPassword(...)`
   - Se `data.session` vier:
     - Atualizar **imediatamente** `setSession(data.session)` e `setUser(data.session.user)`
     - Atualizar o cache do guard (`guard.cachedSession`/`guard.cacheTime`)
   - Isso reduz drasticamente a janela onde o app “não enxerga” a sessão.

3. Melhorar o “bootstrap inicial” da sessão no mount do provider:
   - Após registrar o `onAuthStateChange`, disparar **uma única tentativa** de `ensureSession()` (single-flight) para “aquecer” a sessão em cold start.
   - Com guard/caching, isso não vira storm, e ajuda muito no preview.

### B) `src/pages/Auth.tsx` — parar de forçar `/dashboard` quando já tem sessão
1. Ajustar o `useEffect` “já autenticado” (linhas ~195-203):
   - Em vez de `navigate(postAuthRedirect)` (que por padrão é `/dashboard`),
   - Fazer:
     - Se existir `redirectParam` válido (ex.: veio de um link específico), respeitar.
     - Caso contrário, calcular `redirectDestination = await getSmartRedirectDestination(session.user.id)` e navegar para ele.
   - Adicionar um `ref` de “já redirecionei” para evitar double navigation.

2. Ajustar `handleLogin` para não depender de `ensureSession()` + delays:
   - Usar `const { error, session: loginSession } = await signIn(...)`
   - Se `loginSession?.user` existe, usar esse userId imediatamente para:
     - checar MFA
     - checar admin
     - calcular redirect inteligente
   - Isso elimina a necessidade do `await new Promise(setTimeout...)`.

3. Ajustar `handle2FASuccess` para também evitar “sessão não pronta”:
   - Depois do MFA verify, chamar `ensureSession()` uma vez e, se tiver session, aplicar `getSmartRedirectDestination`.
   - Se ainda houver instabilidade, evoluir o `TwoFactorVerify` para chamar `ensureSession()` internamente antes de `onSuccess()` (opcional, mas recomendado).

### C) (Opcional, mas mais robusto) Criar uma função de backend para contar departamentos
Se ainda existir alguma instabilidade por RLS/timing em `members/departments`, a solução mais confiável é uma função “security definer” do backend:

- `get_my_department_count()` → retorna inteiro
- Internamente:
  - conta memberships em `members` (user_id = auth.uid())
  - conta liderança em `departments` (leader_id = auth.uid())
  - retorna total único

O frontend chama só `supabase.rpc('get_my_department_count')` e decide o redirect sem depender de queries múltiplas.

(Esse passo é “plano B” caso a hidratação imediata via `signIn` não resolva 100%.)

---

## Arquivos que serão alterados

1. `src/hooks/useAuth.tsx`
   - `signIn` passa a retornar `session`
   - `signIn` atualiza state/cache imediatamente
   - “warm up” inicial com `ensureSession()` após listener

2. `src/pages/Auth.tsx`
   - Corrigir `useEffect` de “já autenticado” para usar redirect inteligente (não default `/dashboard`)
   - `handleLogin` usar `session` retornada por `signIn` e remover delays frágeis
   - Ajustar `handle2FASuccess` para ser mais consistente

3. (Opcional) migração backend: função `get_my_department_count()`

---

## Como vamos validar (passo a passo)

1) **Teste o caso crítico (preview “frio”)**
- Abrir preview “zerado” (sem refresh extra)
- Fazer login com um usuário que tem **exatamente 1 departamento**
- Resultado esperado: cair em **`/my-schedules`** sem loop

2) **Teste usuário com 2+ departamentos**
- Resultado esperado: cair em **`/dashboard`**

3) **Teste “já logado” indo em `/auth`**
- Digitar `/auth` na URL com sessão ativa
- Resultado esperado: redirecionar automaticamente para o destino inteligente (não “sempre dashboard”)

4) **(Se usa 2FA)**
- Fazer login com 2FA habilitado
- Após validar código, deve ir para destino inteligente sem cair num loop

---

## Riscos e mitigação

- Alterar a assinatura de `signIn` impacta chamadas existentes (principalmente `Auth.tsx`). Vamos ajustar todas as chamadas para a nova forma.
- Warm-up do `ensureSession()` pode adicionar uma chamada extra ao iniciar. Como existe single-flight + cache, o impacto é mínimo e melhora a estabilidade.

