
# Redirecionamento Inteligente Pós-Login

## O que será implementado

Modificar o fluxo de login para redirecionar o usuário baseado na quantidade de departamentos:

| Departamentos | Destino |
|---------------|---------|
| 0 | Dashboard (para criar ou entrar em um departamento) |
| 1 | Minhas Escalas (acesso direto às suas escalas) |
| 2+ | Dashboard (para escolher qual departamento acessar) |

---

## Problema do Loop Identificado

O loop ocorre porque:
1. `Auth.tsx` redireciona para `/dashboard` após login
2. `ProtectedRoute` verifica sessão com delay de 300ms + timeout de 8s
3. Se a sessão não é detectada a tempo, manda de volta para `/auth`
4. Isso cria um ciclo infinito em algumas condições de rede/timing

**Causa raiz**: A verificação de sessão no ProtectedRoute pode falhar se o `ensureSession()` demora ou não retorna a sessão corretamente.

---

## Solução Técnica

### 1. Modificar Auth.tsx - handleLogin()

Após login bem-sucedido, antes de redirecionar, consultar os departamentos do usuário:

```typescript
// Após verificar MFA e admin role...

// Buscar departamentos do usuário
const { data: memberDepts, error: memberError } = await supabase
  .from('members')
  .select('department_id')
  .eq('user_id', currentSession.user.id);

const { data: leaderDepts, error: leaderError } = await supabase
  .from('departments')
  .select('id')
  .eq('leader_id', currentSession.user.id);

// Contar total de departamentos únicos
const allDeptIds = new Set([
  ...(memberDepts || []).map(m => m.department_id),
  ...(leaderDepts || []).map(d => d.id)
]);

const departmentCount = allDeptIds.size;

// Redirecionar baseado na contagem
if (departmentCount === 1) {
  navigate('/my-schedules', { replace: true });
} else {
  navigate('/dashboard', { replace: true });
}
```

### 2. Também aplicar na handle2FASuccess()

Mesma lógica para usuários que fazem login com 2FA.

### 3. Corrigir ProtectedRoute para evitar loop

Adicionar flag para evitar múltiplas tentativas de recuperação:

```typescript
const recoveryAttemptedRef = useRef(false);

// Na lógica de recovery
if (recoveryAttemptedRef.current) {
  // Já tentamos recuperar, redirecionar para login
  navigate('/auth', { replace: true });
  return;
}
recoveryAttemptedRef.current = true;
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/Auth.tsx` | Adicionar lógica de contagem de departamentos em `handleLogin()` e `handle2FASuccess()` |
| `src/components/ProtectedRoute.tsx` | Adicionar guard para evitar loop de tentativas de recovery |

---

## Fluxo Após Implementação

```
Usuário faz login
        │
        ▼
  Verificar MFA → Se precisa 2FA → Tela 2FA → Sucesso
        │                                       │
        ▼                                       ▼
  Verificar Admin → Se Admin → /admin
        │
        ▼
  Contar departamentos
        │
        ├── 0 departamentos → /dashboard
        │
        ├── 1 departamento → /my-schedules
        │
        └── 2+ departamentos → /dashboard
```

---

## Resultado Esperado

1. **Membro de 1 departamento**: Login → vai direto para "Minhas Escalas"
2. **Membro de 2+ departamentos**: Login → vai para Dashboard para escolher
3. **Novo usuário (0 departamentos)**: Login → vai para Dashboard para criar/entrar
4. **Admin**: Login → vai para /admin (comportamento mantido)
5. **Loop corrigido**: ProtectedRoute não tenta recovery infinitamente
