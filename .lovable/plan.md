## Logo LEVI Esmeralda + Atualizacoes de Favicon e Sidebar

### Resumo

Gerar uma versao do logo LEVI na cor verde esmeralda usando IA, aplicar em todas as paginas, remover o contorno amarelo do logo na sidebar, atualizar favicon e icones PWA, e garantir que o avatar do usuario apareca no lugar de "Dashboard". em todos os lugares nas paginas nos sibebar se ele estivar logado

---

### 1. Gerar logo LEVI em verde esmeralda

Usar a API de edicao de imagem (Gemini) para recolorir o logo atual (`levi-icon-new.png`) para verde esmeralda. Salvar como novo asset `levi-icon-emerald.png`.

Tambem gerar versoes para PWA:

- `public/pwa-192x192.png` (192x192)
- `public/pwa-512x512.png` (512x512)
- `public/favicon.png`

### 2. Atualizar `LeviLogo.tsx`

Trocar a importacao de `levi-icon-new.png` para `levi-icon-emerald.png`.

### 3. Remover contorno amarelo na sidebar (`DashboardSidebar.tsx`)

**Antes (linha 68):**

```html
<div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shadow-lg">
```

**Depois:**

```html
<div className="w-10 h-10 rounded-xl flex items-center justify-center">
```

Remover `bg-secondary` e `shadow-lg` para eliminar o fundo amarelo/ambar.

### 4. Garantir avatar no lugar de "Dashboard"

Na linha 100 do sidebar, o texto fallback e `userName || 'Dashboard'`. Trocar para mostrar apenas o nome ou "Meu Perfil":

```tsx
<span>{userName || 'Meu Perfil'}</span>
```

### 5. Atualizar Auth.tsx - Logo esmeralda

Na pagina de login (linha 975), trocar `bg-secondary` por uma cor esmeralda:

```html
<div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-glow-sm">
```

E usar o `LeviLogo` em vez do icone Calendar.

### 6. Atualizar PWA manifest

No `vite.config.ts`, o `theme_color` e `background_color` mudam de `#DD640A` (ambar) para `#10B981` (esmeralda).

No `index.html`, atualizar `meta[name="theme-color"]` e `meta[name="msapplication-TileColor"]` para `#10B981`.

---

### Arquivos a editar

1. **Gerar imagem** - Logo esmeralda via AI image editing (edge function ou inline)
2. `**src/components/LeviLogo.tsx**` - Nova imagem
3. `**src/components/DashboardSidebar.tsx**` - Remover bg-secondary do logo, fix fallback "Dashboard"
4. `**src/pages/Auth.tsx**` - Logo esmeralda + usar LeviLogo
5. `**vite.config.ts**` - theme_color esmeralda
6. `**index.html**` - meta theme-color esmeralda
7. `**public/favicon.png**`, `**public/pwa-192x192.png**`, `**public/pwa-512x512.png**` - Icones esmeralda

### Detalhes tecnicos

**Geracao da imagem:** Chamar a API Lovable AI com o modelo `google/gemini-2.5-flash-image` passando o logo atual e instrucao para recolorir para verde esmeralda (`#10B981`). Converter o base64 resultante para arquivos PNG nos tamanhos necessarios.

**Cor esmeralda:** `#10B981` (Tailwind emerald-500), usado consistentemente em theme-color, background PWA e container do logo.