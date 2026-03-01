

## Simplificar Landing Page e Login/Cadastro como Modal

### Resumo
Transformar a landing page em uma tela unica sem rolagem, com conteudo lado a lado (info + features compactas), e converter o login/cadastro em um modal centralizado com fundo transparente/blur que aparece sobre a landing page.

---

### 1. Simplificar a Landing Page (`src/pages/Landing.tsx`)

Redesign completo para caber em uma unica tela (100vh):

**Layout lado a lado:**
- **Lado esquerdo**: Logo LEVI, titulo, subtitulo curto, contador de usuarios, botoes "Entrar" e "Criar Conta" (abrem o modal de auth)
- **Lado direito**: 3-4 features compactas em grid (icone + titulo, sem descricao longa)

**Remover:**
- Botao "Acessar com Codigo" (e o link para `/acessar`)
- Secao de screenshots/carousel
- Secao de recursos detalhados (6 cards)
- Secao de apoio/doacao
- Secao CTA final
- Footer
- Botao "Ver demonstracao"

**Manter:**
- Nav com logo, ThemeToggle, botao Instalar (PWA), botoes Entrar/Criar Conta
- Contador de usuarios cadastrados
- DemoTour e PWAInstallPrompt (componentes de dialog)

### 2. Auth como Modal na Landing (`src/pages/Landing.tsx`)

Em vez de navegar para `/auth`, abrir um Dialog/modal na propria landing page:

- Usar o componente `Dialog` do Radix com overlay `bg-black/40 backdrop-blur-sm` (fundo transparente com blur)
- O conteudo do modal sera o formulario de login/cadastro (extraido/inline)
- Modal centralizado, `max-w-md`, com bordas arredondadas e glass effect
- Tabs Entrar/Criar Conta dentro do modal
- Manter toda a logica de auth existente (signIn, signUp, Google, Apple, recovery, etc.)

### 3. Rota `/auth` continua funcionando

A pagina `/auth` existente continua funcionando normalmente para links diretos (recovery, convites, etc.). O modal na landing e uma forma alternativa de acessar.

---

### Arquivos a editar

1. **`src/pages/Landing.tsx`** - Redesign completo: layout lado a lado em 100vh, sem scroll, modal de auth integrado
2. **`src/pages/Auth.tsx`** - Sem alteracoes (continua funcionando para links diretos)

### Detalhes tecnicos

**Estrutura da nova Landing:**
```text
+--------------------------------------------------+
| Nav: Logo LEVI | ThemeToggle | Entrar | Criar     |
+--------------------------------------------------+
|                                                    |
|  [Lado Esquerdo]         [Lado Direito]           |
|                                                    |
|  Logo grande              Feature 1 (icone+titulo)|
|  "Organize escalas        Feature 2               |
|   com facilidade"          Feature 3               |
|                            Feature 4               |
|  123+ voluntarios                                  |
|  cadastrados                                       |
|                                                    |
|  [Entrar]  [Criar Conta]                          |
|                                                    |
+--------------------------------------------------+
```

**Modal de Auth (Dialog):**
```tsx
<Dialog open={showAuth} onOpenChange={setShowAuth}>
  <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
    {/* Tabs: Entrar / Criar Conta */}
    {/* Formularios de login/registro */}
    {/* Social login (Google/Apple) */}
    {/* Link "Esqueceu senha?" */}
  </DialogContent>
</Dialog>
```

**Overlay transparente:**
```tsx
<DialogOverlay className="bg-black/40 backdrop-blur-sm" />
```

O modal inclui a logica completa de auth: login com email/senha, login social (Google, Apple), recuperacao de senha, e registro (quando tem contexto de igreja). Para registro sem codigo de igreja, redireciona para `/auth?tab=register` com contexto adequado.
