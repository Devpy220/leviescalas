

## Atualizar Icone LEVI com Cantos Arredondados

O novo icone SVG enviado sera usado em todos os lugares do app: favicon, icones PWA (192x192 e 512x512), e componente LeviLogo. O icone tera cantos arredondados para melhor visibilidade.

---

### O que sera feito

**1. Preparar o SVG com cantos arredondados**
- Modificar o SVG do icone adicionando um `clipPath` com retangulo arredondado (`rx="80" ry="80"`) para que o proprio arquivo tenha cantos redondos
- Copiar o SVG modificado para `public/levi-icon.svg` (para favicon) e `src/assets/levi-icon.svg` (para imports React)

**2. Gerar PNGs arredondados para PWA**
- Criar uma funcao backend temporaria que usa o modelo de geracao de imagem (Nano banana) para produzir versoes PNG arredondadas do icone em 192x192 e 512x512
- Os PNGs gerados substituirao `public/pwa-192x192.png` e `public/pwa-512x512.png`
- Tambem atualizar `public/favicon.png` com versao arredondada, forçar atualização do icone inatalado no device para todos usuarios na proxima vez que entrar

**3. Atualizar referencias no projeto**

| Arquivo | Mudanca |
|---------|---------|
| `index.html` | Atualizar `<link rel="icon">` para referenciar o novo favicon |
| `src/components/LeviLogo.tsx` | Usar o novo SVG importado de `@/assets/levi-icon.svg` com `rounded-2xl` |
| `vite.config.ts` | Atualizar `includeAssets` e confirmar paths dos icones PWA |
| `src/components/demo-tour/steps/WelcomeStep.tsx` | Ja usa LeviLogo, atualiza automaticamente |

**4. Atualizar manifesto PWA**
- Confirmar que `theme_color` e `background_color` no `vite.config.ts` estao alinhados com a cor laranja do novo icone (`#DD640A`)

---

### Detalhes tecnicos

- O SVG sera modificado adicionando `<clipPath>` com `<rect rx="80" ry="80">` aplicado ao grupo principal
- O componente `LeviLogo` passara a importar o SVG como modulo ES6 (`import leviIcon from "@/assets/levi-icon.svg"`) em vez de referenciar `/favicon.png`
- Para os PNGs do PWA, sera criada uma funcao backend usando o modelo `google/gemini-2.5-flash-image` para gerar as versoes arredondadas nos tamanhos corretos
- A classe CSS `rounded-2xl` no componente garante bordas arredondadas mesmo em contextos onde o SVG e renderizado como `<img>`
- O `background_color` do manifesto sera atualizado de `#0F0F23` (antigo tema escuro) para `#DD640A` (laranja do icone) para splash screen mais coerente

