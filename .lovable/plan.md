
Objetivo
- Parar o travamento “fica carregando para sempre” após login (primeiro vai para /dashboard, depois de reiniciar vai para /my-schedules), que está acontecendo em todas as contas, tanto no Preview quanto no Publicado.

O que eu encontrei (diagnóstico com base em evidências reais)
1) O console mostra um erro crítico de autenticação antes/depois do login:
- `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` (código `refresh_token_not_found`, status 400)
Isso significa que o navegador está tentando “recuperar/atualizar” uma sessão antiga usando um refresh token que não existe mais no backend (token antigo/corrompido/invalidado). Quando isso acontece, o client de auth entra num estado inconsistente: ele tenta recuperar a sessão no boot, falha, e você acaba com login “meio funcionando” (toast de sucesso aparece), mas as páginas seguintes ficam presas em loading porque parte do sistema continua tentando consertar a sessão/refresh.

2) O smart redirect está variando no mesmo usuário:
- Log 1: `[Auth] Smart redirect - departments found via RPC: 0` → redireciona `/dashboard`
- Log 2: depois: `[Auth] ...: 1` → redireciona `/my-schedules`
Isso é um sintoma típico quando:
- A sessão ainda não está estável (token inválido/refresh falhando), então chamadas autenticadas podem falhar/sair com resultado inesperado.
- Ou há um “boot/hidratação” do auth acontecendo enquanto o redirect decide o destino, causando um resultado inconsistente.

3) Há um bug estrutural no `ensureSession()` do `useAuth.tsx` que impede tratar erros do `getSession()`:
Hoje o código faz:
- `const { data } = await withTimeout(supabase.auth.getSession(), ...)`
Mas `supabase.auth.getSession()` retorna `{ data, error }`.
Como o `error` é descartado, o sistema não detecta explicitamente “refresh token inválido” para executar um “logout limpo” e limpar o storage. Resultado: o app pode continuar preso em tentativas de recuperação e manter a UI em spinner.

Hipótese mais provável (e consistente com o seu relato “tem lixo no sistema”)
- O “lixo” é storage local (localStorage) com tokens antigos do auth.
- Em especial, o refresh token salvo sob chaves `sb-...-auth-token` (padrão) pode ficar inválido por diversos motivos (troca de conta, reinstalação/PWA, limpeza parcial de storage, invalidação no backend, etc.).
- Quando o app abre, o auth client tenta recuperar e atualizar a sessão com esse refresh token. Como o token não existe mais, dispara `refresh_token_not_found`.
- A partir daí, o app pode:
  - Logar “com sucesso” (porque você digitou email/senha e gerou tokens novos),
  - mas ao mesmo tempo o client ainda tem tentativa de recuperação inicial falhando/concorrendo,
  - e isso leva a travamentos pós-login (spinners) e redirects inconsistentes (0 departamento / 1 departamento).

Plano de correção (mudanças no sistema “em geral”, não só numa tela)
A) Corrigir `ensureSession()` para capturar e tratar erro de refresh token inválido
Arquivos: `src/hooks/useAuth.tsx`

1. Alterar `ensureSession()` para preservar `{ data, error }` do `getSession()`
- Em vez de descartar o `error`, vamos analisá-lo.

2. Quando `error` for `AuthApiError` com `code === 'refresh_token_not_found'` (ou mensagem contendo “Invalid Refresh Token”):
- Executar um “logout limpo”:
  - Limpar as chaves do auth do localStorage (as chaves `sb-...-auth-token` e correlatas).
  - Limpar cache do guard (`guard.cachedSession`, `guard.cacheTime`, `guard.lastBootstrapUserId`).
  - Chamar `supabase.auth.signOut()` (sem depender do refresh).
  - Retornar `null` e garantir `setLoading(false)` para não manter a UI presa.

Resultado esperado:
- Em vez de ficar em estado quebrado, o app detecta o token inválido e “volta para um estado limpo” de deslogado, permitindo login normal sem travar.

B) Adicionar um “Recovery Guard” no bootstrap do AuthProvider para evitar travamento silencioso no boot
Arquivos: `src/hooks/useAuth.tsx`

- No `useEffect` de inicialização (onde já existe `void ensureSession()`), vamos:
  - Fazer `await ensureSession()` e, se detectar que limpamos sessão por erro de refresh token, opcionalmente redirecionar para `/auth?expired=true` (ou apenas manter deslogado, dependendo do comportamento atual desejado).
- Importante: essa ação deve ser idempotente e não causar loops.

C) Colocar timeout e fallback seguros nas RPCs usadas no redirect pós-login
Arquivos: `src/pages/Auth.tsx`

Problema atual:
- `getSmartRedirectDestination()` depende de `supabase.rpc('get_my_department_count')`.
- Se o auth estiver instável (ou o RPC estiver lento), o login fica esperando e a UI parece “rodar para sempre”.

Mudança:
- Envolver `supabase.rpc('get_my_department_count')` com um timeout curto (ex.: 3–5s) e fallback consistente:
  - Se timeout ou erro: retornar `/dashboard` (ou `/my-schedules` se você preferir, mas recomendo `/dashboard` como “safe landing”).
- Garantir que `setIsLoading(false)` sempre aconteça em `finally` no `handleLogin` e também no fluxo 2FA.

Resultado esperado:
- Mesmo que a RPC falhe momentaneamente, o usuário não fica preso em loading infinito.

D) Instrumentação (temporária) para confirmar a causa no Preview e no Publicado
Arquivos: `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`

Adicionar logs controlados (somente console) por alguns dias:
- Log quando detectar `refresh_token_not_found` e limpar storage.
- Log do tempo (ms) gasto em `get_my_department_count` e se ocorreu timeout.

Isso vai permitir confirmar objetivamente:
- “O travamento é causado por refresh token inválido no storage”
- “O redirect travava por RPC lenta/sem resposta”

Sequência de implementação (para reduzir risco)
1) Ajustar `ensureSession()` para capturar `{ error }` e tratar `refresh_token_not_found` com limpeza + signOut.
2) Ajustar bootstrap do AuthProvider para usar esse `ensureSession()` de forma segura.
3) Adicionar timeout/fallback no `getSmartRedirectDestination()` e garantir `isLoading` sempre desliga.
4) (Opcional) Revisar `get_my_department_count` caso ainda haja inconsistência, mas primeiro precisamos estabilizar o auth.

Como você vai validar (passo a passo)
1) Teste principal (reproduz seu problema):
- Abrir Preview
- Fazer login com a conta de 1 departamento
- Esperado: entrar sem “spinner infinito”.
- Recarregar a página e repetir
- Esperado: não alternar “primeiro dashboard / depois minhas escalas” por instabilidade.

2) Teste de “storage sujo”:
- Simular cenário real: repetir login/logout algumas vezes
- Esperado: sem travas e sem `refresh_token_not_found` persistente.

3) Confirmar pelo console:
- Não deve mais aparecer `Invalid Refresh Token: Refresh Token Not Found`.
- Se aparecer, deve vir acompanhado do log de “limpeza + logout”, e a app deve se recuperar (não travar).

Observações importantes
- Isso explica por que “só entra depois de reiniciar várias vezes”: reiniciar muda timing e às vezes “ganha” a corrida, mas o problema raiz (refresh token inválido no storage + falta de tratamento no ensureSession) continua.
- Esse conserto é sistêmico: estabiliza autenticação no boot e evita que qualquer tela protegida fique presa por sessão quebrada.

Arquivos que serão alterados
- `src/hooks/useAuth.tsx` (correção do ensureSession + tratamento do refresh_token_not_found + limpeza de storage + logs)
- `src/pages/Auth.tsx` (timeout/fallback nas RPCs do redirect e garantia de desligar loading)
