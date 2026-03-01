

## Remover fundo branco do logo LEVI no sidebar

### Problema
O arquivo `levi-icon-emerald.png` ainda possui pixels brancos no fundo da imagem. Quando renderizado sobre o gradiente violeta da sidebar, o branco aparece como um quadrado visivel.

### Solucao

**1. Regenerar a imagem com fundo transparente**

Usar a API de edicao de imagem para gerar novamente o `src/assets/levi-icon-emerald.png`, desta vez com instrucoes explicitas para remover completamente o fundo branco e manter apenas o icone esmeralda com transparencia total (canal alpha).

**2. Adicionar CSS de seguranca no `LeviLogo.tsx`**

Como fallback visual, adicionar a classe `mix-blend-multiply` na tag `<img>` do componente `LeviLogo`. Isso faz com que qualquer pixel branco residual se torne transparente ao se misturar com o fundo colorido. No tema escuro, usar `dark:mix-blend-screen` para o efeito inverso.

### Arquivos a editar

1. `src/assets/levi-icon-emerald.png` -- Regenerar com fundo 100% transparente
2. `src/components/LeviLogo.tsx` -- Adicionar `mix-blend-multiply dark:mix-blend-screen` como fallback

### Detalhe tecnico

```tsx
// LeviLogo.tsx - adicionar mix-blend-mode
<img 
  src={leviIcon} 
  alt="LEVI" 
  className={`${sizeClasses[size]} mix-blend-multiply dark:mix-blend-screen ${className}`}
/>
```

Isso garante que mesmo que a imagem tenha residuos brancos, eles nao aparecerao sobre fundos coloridos (sidebar violeta, cards, etc).

