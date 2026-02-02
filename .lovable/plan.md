

## Plano de Correção: Loop ao Logar e Recuperação de Senha

### Diagnóstico dos Problemas

#### Problema 1: Loop ao Logar (Preview "frio")
O ciclo ocorre por uma "corrida" entre três componentes:
1. **ProtectedRoute** tenta verificar sessão → não encontra → redireciona para `/auth`
2. **Auth.tsx** recebe a sessão atrasada → detecta usuário logado → redireciona para `/dashboard`
3. Ciclo recomeça se o timing variar

**Causa raiz**: A sessão demora para "hidratar" no primeiro carregamento do preview. O `ProtectedRoute` não espera o suficiente e manda para `/auth`, mas quando chega lá a sessão aparece e manda de volta.

#### Problema 2: Recuperação de Senha Não Abre Formulário
Quando o usuário clica no link do email de recuperação:
1. O link traz um `?code=...` (fluxo PKCE) ou `#access_token=...` (fluxo implícito)
2. O `Auth.tsx` troca o código por sessão com sucesso via `exchangeCodeForSession`
3. Isso dispara o evento `SIGNED_IN` no Supabase
4. O useEffect de "já autenticado" (linha 198-221) detecta `session` e redireciona para dashboard **antes** que `setActiveTab('reset-password')` faça efeito

**Causa raiz**: O fluxo de recovery cria uma sessão temporária. O código atual detecta essa sessão como "usuário logado" e redireciona automaticamente, impedindo a exibição do formulário de nova senha.

---

### Correções Propostas

#### A) Corrigir o Loop ao Logar

**Arquivo: `src/pages/Auth.tsx`**
- Adicionar um **delay de estabilização** no useEffect de "já autenticado" para dar tempo à sessão se estabilizar
- Melhorar a checagem de `isRecovery` para incluir a aba `reset-password` ativa

**Arquivo: `src/components/ProtectedRoute.tsx`**
- O código atual já tem um delay de 300ms e timeout de 8s, o que é adequado
- Vamos apenas garantir que o `user || session` seja verificado corretamente

#### B) Corrigir a Recuperação de Senha

**Arquivo: `src/pages/Auth.tsx`**
1. **Bloquear redirecionamento automático quando estamos em fluxo de recovery**:
   - Adicionar verificação: se `activeTab === 'reset-password'`, NÃO redirecionar
   - Usar uma flag `isInRecoveryFlow` baseada no contexto da URL + aba atual

2. **Garantir que o `setActiveTab('reset-password')` execute ANTES do redirect**:
   - O `exchangeCodeForSession` vai disparar eventos de auth
   - Precisamos setar a flag de recovery ANTES de trocar o código

3. **Evitar que o Supabase interprete a sessão de recovery como login normal**:
   - Após trocar o código por sessão, imediatamente setar `activeTab` para `reset-password`
   - Guardar uma ref `isRecoveryFlowRef` para bloquear o redirect automático

---

### Detalhes Técnicos da Implementação

#### Mudanças em `src/pages/Auth.tsx`

**1. Adicionar ref para controlar fluxo de recovery:**
```typescript
const isRecoveryFlowRef = useRef(false);
```

**2. Modificar o useEffect de troca de código (linhas 153-185):**
- ANTES de chamar `exchangeCodeForSession`, setar `isRecoveryFlowRef.current = true`
- Isso vai impedir o redirect automático no outro useEffect

**3. Modificar o useEffect de "já autenticado" (linhas 198-221):**
- Adicionar condição: `!isRecoveryFlowRef.current`
- Adicionar condição: `activeTab !== 'reset-password'`
- Isso garante que, se estivermos no fluxo de recuperação, não vai redirecionar

**4. Adicionar delay de estabilização para evitar loop:**
- No useEffect de "já autenticado", adicionar um pequeno delay (100-200ms) para garantir que todos os estados tenham sido atualizados antes de decidir redirecionar

#### Mudanças em `src/hooks/useAuth.tsx`

**1. Corrigir URL de redirecionamento (linha 341):**
- A URL atual é `/admin-login?reset=true` que redireciona para `/auth?forceLogin=true`
- O `forceLogin=true` faz logout da sessão!
- Mudar para apenas `${window.location.origin}/auth`

---

### Arquivos a Serem Alterados

1. **`src/pages/Auth.tsx`**
   - Adicionar `isRecoveryFlowRef` para controlar fluxo
   - Modificar useEffect de troca de código para setar flag antes
   - Modificar useEffect de "já autenticado" para respeitar recovery flow
   - Adicionar delay de estabilização

2. **`src/hooks/useAuth.tsx`**
   - Corrigir `redirectTo` na função `resetPassword` de `/admin-login?reset=true` para `/auth`

---

### Validação

1. **Teste de Loop**:
   - Abrir preview "frio" (sem sessão)
   - Fazer login
   - Deve ir para o destino correto sem ficar oscilando

2. **Teste de Recuperação de Senha**:
   - Solicitar recuperação de senha
   - Clicar no link do email
   - Deve aparecer o formulário "Nova senha" em vez de ir direto para dashboard

3. **Teste de Usuário Já Logado**:
   - Com sessão ativa, acessar `/auth`
   - Deve redirecionar para dashboard/my-schedules (não mostrar login)

