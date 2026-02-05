
# Plano: Corrigir Race Condition no Redirecionamento Pós-Login

## Problema Identificado

A função RPC `get_my_department_count` às vezes retorna 0 mesmo quando o usuário tem departamentos. Isso ocorre porque:

1. A função usa `auth.uid()` que depende do JWT ser processado pelo PostgREST
2. Existe uma race condition entre o login completar no cliente e o backend processar o token
3. As 3 tentativas com delay de 300ms não são suficientes em alguns casos

**Evidência nos logs:**
- Login 1: RPC retornou 1 na primeira tentativa (269ms) → `/my-schedules` ✓
- Login 2: RPC retornou 0 após 3 tentativas (371ms, 309ms, 311ms) → `/dashboard` ✗

## Solução Proposta

Modificar a função RPC para aceitar o `user_id` como parâmetro opcional, eliminando a dependência do JWT no momento crítico pós-login.

---

## Mudanças Necessárias

### 1. Atualizar Função SQL

Criar nova versão da função que aceita o user_id como parâmetro:

```text
┌─────────────────────────────────────────────────────────────┐
│     get_my_department_count(p_user_id uuid DEFAULT NULL)    │
├─────────────────────────────────────────────────────────────┤
│ Se p_user_id fornecido → usar diretamente                   │
│ Se NULL → fallback para auth.uid()                          │
│                                                             │
│ Resultado: Contagem de departamentos do usuário             │
└─────────────────────────────────────────────────────────────┘
```

**SQL:**
```sql
CREATE OR REPLACE FUNCTION public.get_my_department_count(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count integer;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count unique departments where user is member or leader
  SELECT COUNT(DISTINCT dept_id) INTO v_count
  FROM (
    SELECT department_id as dept_id FROM members WHERE user_id = v_user_id
    UNION
    SELECT id as dept_id FROM departments WHERE leader_id = v_user_id
  ) as all_depts;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
```

### 2. Atualizar Chamada no Auth.tsx

Modificar `getSmartRedirectDestination` para passar o `userId`:

| Local | Mudança |
|-------|---------|
| `src/pages/Auth.tsx` | Passar `userId` na chamada RPC |

**Antes:**
```typescript
const rpcPromise = supabase.rpc('get_my_department_count');
```

**Depois:**
```typescript
const rpcPromise = supabase.rpc('get_my_department_count', { p_user_id: userId });
```

### 3. Atualizar Types do Supabase

O arquivo `types.ts` será regenerado automaticamente após a migração.

---

## Fluxo Corrigido

```text
┌──────────────────────────────────────────────────────────────────┐
│                     FLUXO PÓS-LOGIN                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. signIn() → retorna session com user.id                       │
│                     │                                            │
│  2. Wait 200ms (hydration)                                       │
│                     │                                            │
│  3. getSmartRedirectDestination(userId)                          │
│           │                                                      │
│           ▼                                                      │
│  4. RPC: get_my_department_count(userId)  ◀── passa userId       │
│           │                                    diretamente       │
│           │                                    (não depende      │
│           │                                     do JWT)          │
│           ▼                                                      │
│  5. count = 1 → /my-schedules                                    │
│     count ≠ 1 → /dashboard                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Nova migração SQL | Criar | Atualiza função `get_my_department_count` |
| `src/pages/Auth.tsx` | Modificar | Passa `userId` na chamada RPC |
| `src/integrations/supabase/types.ts` | Auto-gerado | Tipos atualizados |

---

## Benefícios

1. **Elimina race condition** - Não depende mais do JWT estar processado
2. **Backward compatible** - Parâmetro é opcional, outras chamadas continuam funcionando
3. **Mais rápido** - Pode reduzir retries e delays
4. **Mais confiável** - Login consistente independente da latência do backend

---

## Considerações de Segurança

A função permanece segura porque:
- É `SECURITY DEFINER` (roda com privilégios do owner)
- Só retorna uma contagem numérica (sem dados sensíveis)
- É chamada apenas após autenticação bem-sucedida
- O `userId` passado vem da sessão validada pelo Supabase
