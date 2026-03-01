

## Corrigir logo LEVI (cor azul/branco) e fundo do calendario

### Problemas identificados

1. **Tema escuro - logo branco**: O `mix-blend-screen` faz pixels claros ficarem brancos no fundo escuro, apagando o logo
2. **Tema claro - logo azul**: O `mix-blend-multiply` mistura o verde esmeralda com o fundo violeta da sidebar, resultando em azul
3. **Calendario interno**: O fundo do calendario (DayPicker) herda o background geral em vez de ser branco

### Solucao

#### 1. Remover blend modes do `LeviLogo.tsx`

Os blend modes estao distorcendo as cores do logo. Em vez disso, remover `mix-blend-multiply` e `dark:mix-blend-screen`, e confiar na transparencia da imagem. Para garantir visibilidade em fundos coloridos (sidebar violeta), adicionar um fundo branco arredondado apenas quando usado sobre fundos escuros/coloridos.

```tsx
<img 
  src={leviIcon} 
  alt="LEVI" 
  className={`${sizeClasses[size]} ${className}`}
/>
```

#### 2. Adicionar fundo branco ao logo na sidebar (`DashboardSidebar.tsx`)

O container do logo na sidebar (linha 68) precisa de um fundo branco para o logo ficar visivel sobre o gradiente violeta:

```tsx
<div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
```

#### 3. Adicionar fundo branco ao logo no Auth.tsx

Trocar `bg-emerald-500` por `bg-white` na linha 976:

```tsx
<div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-glow-sm">
```

#### 4. Fundo branco no calendario (`calendar.tsx`)

Adicionar `bg-white dark:bg-card` ao className do DayPicker para garantir fundo branco no tema claro:

```tsx
className={cn("p-3 bg-white dark:bg-card rounded-xl", className)}
```

### Arquivos a editar

1. `src/components/LeviLogo.tsx` -- Remover mix-blend modes
2. `src/components/DashboardSidebar.tsx` -- Fundo branco no container do logo
3. `src/pages/Auth.tsx` -- Fundo branco no container do logo
4. `src/components/ui/calendar.tsx` -- Fundo branco no calendario

