

## Plano: Modernização da Landing Page — Estilo SaaS Premium

Transformar a landing page atual em um design limpo, profissional e de alto impacto, inspirado em SaaS modernas (Linear, Vercel, Resend).

---

### Arquivos a modificar (3 arquivos, nenhum novo)

**1. `src/index.css` — Tokens de cor + animações CSS**

- Atualizar variáveis `:root` (modo claro):
  - Background: branco puro (`0 0% 100%`), Foreground: quase preto (`0 0% 4%`)
  - Primary: violeta profundo (`258 90% 56%`), Secondary: âmbar vibrante (`38 95% 52%`)
  - Card: `0 0% 98%` com borda `0 0% 90%`, Muted: `0 0% 45%`
- Atualizar variáveis `.dark`:
  - Background: `240 10% 4%`, Card: `240 8% 8%`
  - Primary: `258 100% 72%`, Secondary: `46 100% 60%`
- Adicionar animações CSS:
  - `@keyframes slideUpFade` — entrada suave dos elementos do hero
  - `@keyframes glowPulse` — glow pulsante no botão primário
  - Classes `.animate-slide-up` com delays escalonados e `.btn-glow`
- Limpar `src/App.css` — remover estilos padrão Vite que não são usados

**2. `src/pages/Landing.tsx` — Redesenho visual (manter 100% da lógica)**

Toda a lógica existente permanece intacta: auth, 2FA, recuperação, contato, PWA, contagem de usuários, navegação.

Mudanças visuais:

- **Remover** `ParticleBackground` (canvas pesado no mobile) — substituir por dot grid CSS + blob gradiente borrado
- **Remover** instância do `DemoTour` da landing (componente permanece no projeto)
- **Remover** botão "Instalar" da nav (manter PWAInstallPrompt como popup)

- **NAV**: `bg-background/80 backdrop-blur-xl`, borda sutil ao scrollar. Logo + Typewriter à esquerda. Direita: "Contato" (texto), ThemeToggle, "Entrar" como pill preenchido

- **HERO**: Layout duas colunas (desktop), coluna única centralizada (mobile):
  - Esquerda: badge pill, H1 grande com Typewriter, subtítulo, CTAs (botão primário "Entrar" com glow + ghost "Ver demonstração"), social proof (3 avatares + contador)
  - Direita: FeatureCube 3D (mantido)
  - Background: dot grid CSS (`radial-gradient` repetido) + blob violeta/âmbar com `blur(120px)`

- **FEATURES (carousel)**: Cards com `bg-card` sólido, `border border-border`, `rounded-2xl`, `shadow-sm`, padding `p-10`. Ícone maior, título `text-xl font-bold`. Seção fixa "Funcionalidades" (remover label dinâmico)

- **FOOTER**: Linha separadora. 2 colunas: `© 2025 LEVI Escalas` + logo ELSDIGITAL. Link "Política de Privacidade" (visual only)

- **Modal de Login**: `max-w-sm`, `rounded-3xl`, `p-8`, `shadow-2xl`. Inputs `h-12` com ring violeta. Botão submit com gradiente. Botões Google/Apple `w-full h-11` com texto ("Continuar com Google"). Divisor "ou continue com"

- **Modal de Contato**: Mesmo padrão visual do login modernizado

**3. `src/App.css` — Limpar estilos Vite padrão**

Remover regras `#root`, `.logo`, `.card`, `.read-the-docs` que são resquícios do template Vite e não são usados.

---

### O que NÃO muda

- Toda lógica de autenticação, hooks, integração com backend
- Componentes: LeviLogo, LeviTypewriter, FeatureCube, ThemeToggle, TwoFactorVerify, PWAInstallPrompt
- Rotas, navegação, formulários de contato
- `tailwind.config.ts` — sem alterações
- Nenhum arquivo novo criado

