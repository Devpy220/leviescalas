
# Correções: Login, Recuperação de Senha e Nomenclatura de Funções

## Resumo dos Problemas Identificados

### Problema 1: Login automático ao invés de escolher conta
O sistema redireciona automaticamente para o dashboard quando o usuário já está logado e clica em "Entrar". Isso acontece porque:
- Na página `/igreja/{slug}`, o botão "Entrar" vai para `/auth?church={slug}`
- O `Auth.tsx` detecta que já existe uma sessão e redireciona para o dashboard

**Solução:** Adicionar um parâmetro `forceLogin=true` no link "Entrar" da página da igreja, e no `Auth.tsx` fazer logout automático quando esse parâmetro estiver presente, permitindo ao usuário entrar com outra conta.

### Problema 2: Recuperação de senha não mostra tela para mudar
O fluxo de recuperação está implementado, mas pode não estar funcionando corretamente em alguns casos. O código detecta o link de recuperação e mostra a tela de redefinição. 

**Solução:** Verificar e garantir que a tela `reset-password` está sendo exibida corretamente após clicar no link do email. Adicionar logs e melhorar o tratamento do link de recuperação.

### Problema 3: Mudar "Participante" para "Culto"
O usuário quer que a função "Participante" (✅) seja renomeada para "Culto".

**Solução:** Atualizar o arquivo `src/lib/constants.ts` para mudar o label de "Participante" para "Culto".

---

## Alterações a Serem Feitas

### 1. Arquivo: `src/lib/constants.ts`
Mudar o label de "Participante" para "Culto":

```typescript
export const ASSIGNMENT_ROLES = {
  on_duty: { 
    label: 'Plantão', 
    description: 'Fica o tempo todo (não participa do culto)',
    icon: '🚗',
    color: 'text-amber-600 dark:text-amber-400'
  },
  participant: { 
    label: 'Culto',  // ← Mudança de "Participante" para "Culto"
    description: 'Pode participar do culto',
    icon: '✅',
    color: 'text-green-600 dark:text-green-400'
  }
} as const;
```

### 2. Arquivo: `src/pages/ChurchPublic.tsx`
Adicionar parâmetro `forceLogin=true` no botão "Entrar":

```tsx
<Link to={`/auth?church=${slug}&forceLogin=true`}>
  <Button variant="outline" size="sm">
    <LogIn className="w-4 h-4 mr-1" />
    Entrar
  </Button>
</Link>
```

### 3. Arquivo: `src/pages/Auth.tsx`
Detectar o parâmetro `forceLogin` e fazer logout antes de mostrar a tela de login:

```typescript
// No início do componente, junto com outros useEffect
const forceLogin = searchParams.get('forceLogin') === 'true';

useEffect(() => {
  const handleForceLogin = async () => {
    if (forceLogin && session) {
      // Fazer logout silencioso para permitir login com outra conta
      await supabase.auth.signOut();
    }
  };
  handleForceLogin();
}, [forceLogin, session]);
```

Também ajustar a lógica de redirecionamento para não redirecionar quando `forceLogin` está ativo:

```typescript
// Na verificação de sessão existente
if (!loading && session && !isRecovery && !isLoading && !forceLogin) {
  navigate(postAuthRedirect, { replace: true });
}
```

---

## Fluxo Após as Alterações

### Para Login:
1. Usuário na página da igreja clica em "Entrar"
2. Sistema redireciona para `/auth?church=slug&forceLogin=true`
3. Se já logado, faz logout silencioso
4. Mostra tela de login limpa para entrar com qualquer conta

### Para Recuperação de Senha:
1. Usuário solicita recuperação de senha
2. Recebe email com link
3. Clica no link → sistema detecta o parâmetro de recuperação
4. Exibe formulário para criar nova senha
5. Após salvar, redireciona para login

### Para Funções nas Escalas:
- "Plantão" 🚗 - Membro fica o tempo todo (não participa do culto)
- "Culto" ✅ - Membro pode participar do culto (antes era "Participante")

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/constants.ts` | Mudar "Participante" → "Culto" |
| `src/pages/ChurchPublic.tsx` | Adicionar `forceLogin=true` no link "Entrar" |
| `src/pages/Auth.tsx` | Tratar `forceLogin` para fazer logout e mostrar login limpo |
