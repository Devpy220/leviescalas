## Objetivo

Acrescentar **Face ID / Touch ID / digital** como forma **opcional** de entrar no LEVI, **sem remover** o login por email e senha. Quem ativar passa a ver um botão "Entrar com Face ID" na tela de login, ao lado do formulário tradicional.

A tecnologia usada é **WebAuthn / Passkeys** — padrão nativo do navegador. Não precisa instalar app, não usa biblioteca paga, funciona em:
- iPhone/iPad → Face ID ou Touch ID
- Android → digital ou rosto
- Mac → Touch ID
- Windows → Windows Hello

A chave biométrica fica **no aparelho do usuário**, o LEVI guarda só uma referência pública. Se o usuário perder o aparelho, ele continua entrando por email/senha normalmente.

## Como funciona para o usuário

1. **Cadastro da biometria** (uma vez)
   - Usuário entra normal por email/senha
   - Em "Segurança" → novo card "Entrar com Face ID / digital"
   - Clica "Ativar" → o sistema operacional pede Face ID/digital → pronto
   - Pode ter até 3 dispositivos cadastrados (celular, tablet, notebook)
   - Pode remover um dispositivo a qualquer momento

2. **Login com biometria**
   - Na tela `/auth`, abaixo do formulário, aparece botão **"Entrar com Face ID"** (só se o navegador suportar)
   - Usuário digita só o email → clica no botão → SO pede biometria → entra direto

3. **Fallback**
   - Se a biometria falhar, recusar, ou o aparelho não tiver suporte, o formulário de senha continua funcionando normal.

## Escopo técnico

### Backend (Lovable Cloud)

**Nova tabela `webauthn_credentials`**
- `user_id` (referência ao perfil)
- `credential_id` (id público da chave, único)
- `public_key` (chave pública em base64)
- `counter` (contador anti-replay)
- `device_name` (ex: "iPhone de João")
- `created_at`, `last_used_at`
- RLS: usuário só vê/apaga as próprias credenciais

**Nova tabela `webauthn_challenges`** (temporária, expira em 5 min)
- `challenge`, `email`, `type` (register/login), `expires_at`

**3 Edge Functions novas:**
- `webauthn-register-options` — gera challenge para cadastro (precisa estar logado)
- `webauthn-register-verify` — valida e salva a credencial
- `webauthn-login-options` — gera challenge para login (público, recebe email)
- `webauthn-login-verify` — valida assinatura, gera sessão Supabase via `admin.generateLink` e devolve tokens

Usar a lib `@simplewebauthn/server` (Deno via npm:) — é a referência do mercado.

### Frontend

- **`src/lib/webauthn.ts`** — helpers usando `@simplewebauthn/browser` (registerCredential, authenticate, isSupported)
- **`src/pages/Security.tsx`** — novo card "Login por biometria" listando dispositivos cadastrados + botão "Adicionar este dispositivo" + remover
- **`src/pages/Auth.tsx`** — abaixo do botão "Entrar", mostrar botão **"Entrar com Face ID"** quando `isSupported() === true`. Fluxo: pede email → chama login-verify → `supabase.auth.setSession(tokens)` → redireciona pra `/dashboard`

### Compatibilidade

- iOS Safari 16+, Chrome/Edge/Firefox modernos: ✅
- Requer HTTPS (já temos em leviescalas.com.br e leviescalas.lovable.app)
- Em navegadores antigos, o botão simplesmente não aparece — login por senha continua

## Fora do escopo

- Não substituirá a senha (decisão sua: manter os dois lados)
- Não obrigará ninguém — totalmente opcional
- Não vai bloquear o app ao reabrir — só agiliza o login

## Próximo passo

Se aprovar, vou: criar as 2 tabelas + RLS, instalar `@simplewebauthn/browser` no front, criar as 4 edge functions, adicionar o card em Segurança e o botão em /auth.