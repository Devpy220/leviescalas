## Resumo das verificações e ajustes na Landing

### 1. "Fale conosco" — já está integrado ao Z-API ✅

Verificado em `supabase/functions/send-contact-email/index.ts`: apesar do nome legado, a função **não envia email**. Ela monta a mensagem e dispara via `send-whatsapp-notification` (Z-API) para o número administrativo `5518996344885`. Nenhuma ação necessária — está alinhado com a memória de "WhatsApp ONLY via Z-API".

Opcional (limpeza futura, fora deste escopo): renomear a função para `send-contact-whatsapp` para refletir o que ela faz.

### 2. Logo do LEVI no mockup da seção de integração

Em `src/pages/Landing.tsx`, na seção "Integração" (mockup do site embutindo o iframe), substituir o placeholder do calendário por uma prévia mais fiel mostrando o **logo do LEVI** + ícone de calendário, deixando claro o que aparece no site da igreja quando o embed é colado.

Mudança no bloco do mockup (~linha 884):

```tsx
<div className="mt-3 rounded-lg border border-dashed border-border p-4 flex items-center gap-3">
  <LeviLogo size="sm" />
  <div className="text-left">
    <p className="text-xs font-semibold text-foreground">Escala da igreja</p>
    <p className="text-[10px] text-muted-foreground">Atualizado em tempo real pelo LEVI</p>
  </div>
  <Calendar className="w-5 h-5 text-primary ml-auto" />
</div>
```

`LeviLogo` já está importado no arquivo, basta usar.

### 3. Remover o carrossel de slides e manter 3 banners por linha

Em `src/pages/Landing.tsx`, seção `#funcionalidades` (~linha 825-831):

**Antes:**
```tsx
<FeatureCarousel />
<FeatureGrid />
```

**Depois:**
```tsx
<FeatureGrid />
```

O `FeatureGrid` já usa `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — ou seja, **3 banners por linha no desktop**, 2 em tablet e 1 em mobile. Não precisa de mudança na grade em si.

A função `FeatureCarousel()` (linhas 433–529) ficará órfã. Para evitar warning de "imports não usados", removê-la inteira do arquivo, junto com os imports que só ela usava (verificar: `Bell`, `RefreshCw`, `LayoutGrid`, `CheckCircle2` se não forem usados em outro lugar — manter os que são).

### Arquivos a editar

- `src/pages/Landing.tsx` — remover `<FeatureCarousel />`, remover a função `FeatureCarousel`, ajustar mockup da seção de integração com `LeviLogo`.

Sem alterações em backend, banco, ou outros componentes.
