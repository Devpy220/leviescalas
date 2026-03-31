

## Plano: Frase do Typewriter em uma única linha no navbar

**Problema**: No mobile (360px), o logo + LeviTypewriter + ThemeToggle competem pelo espaço horizontal, fazendo "Igreja" quebrar para a linha de baixo.

**Solução**: Mover o `ThemeToggle` para dentro do hero ou rodapé no mobile, liberando espaço para a frase ficar em uma linha. Alternativamente, reduzir o tamanho da fonte do typewriter no mobile.

### Abordagem escolhida — Combinação de duas técnicas:

**1. `src/components/LeviTypewriter.tsx`**
- Reduzir o tamanho da fonte no mobile de `text-[10px]` para `text-[8px]` e as letras destacadas (LEVI) de `text-sm` para `text-[10px]`
- Isso garante que a frase completa caiba em uma linha mesmo com o ThemeToggle presente

**2. `src/pages/Landing.tsx`** (navbar)
- No container flex do navbar, usar `gap-1.5` em vez de `gap-2.5` entre logo e typewriter
- Reduzir o padding do logo+nome "LEVI" para ficar mais compacto
- Adicionar `min-w-0` e `overflow-hidden` no container do typewriter para evitar que ele empurre o ThemeToggle

### Resultado esperado
A frase "Logística de Escalas para Voluntários da Igreja" fica inteira em uma linha no mobile 360px, sem quebra de texto.

