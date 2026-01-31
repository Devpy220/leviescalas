
<context>
O problema continua no fluxo “Selecionar Membros” (janela pequena dentro de “Nova Escala”): aparecem alguns nomes, mas a lista não rola (nem no celular nem no computador). Isso indica que a área que deveria rolar está ficando com altura “automática”/insuficiente ou sem um container com altura fixa, então o ScrollArea do Radix não entra em modo de rolagem de verdade.

Pelo código atual em `src/components/department/AddScheduleDialog.tsx`, o “Member Selection Dialog” está assim:
- `DialogContent` tem `max-h-[85vh] flex flex-col overflow-hidden` (mas não tem altura fixa)
- a lista está em `<div className="flex-1 min-h-0 overflow-hidden">`
- e dentro disso: `<ScrollArea className="h-full max-h-[50vh] ...">`

O ponto crítico: `h-full` dentro de um flex layout cuja altura não está explicitamente definida costuma quebrar a rolagem (o “100%” não se resolve corretamente), e `max-h` sozinho também pode não forçar a criação de um viewport com overflow. Resultado: a lista fica “parada”, mostrando só parte do conteúdo e sem rolar.
</context>

<goal>
Garantir que a janela “Selecionar Membros” tenha:
1) Altura definida (não apenas max-height)
2) Uma área central que ocupa o “resto” da janela (flex-1) e realmente permite overflow/scroll
3) Rolagem consistente em desktop e mobile
</goal>

<plan>
1) Ajustar o layout do “Member Selection Dialog” para ter altura fixa e hierarquia de flex correta
   - Arquivo: `src/components/department/AddScheduleDialog.tsx`
   - Trocar no dialog de seleção de membros:
     - De: `DialogContent className="... max-h-[85vh] flex flex-col overflow-hidden"`
     - Para: algo com altura real, por exemplo:
       - `className="sm:max-w-[420px] h-[80vh] max-h-[80vh] flex flex-col overflow-hidden"`
     - Motivo: `h-[80vh]` dá uma base real para o flex calcular alturas internas. `max-h` sozinho não garante isso.

2) Trocar o ScrollArea para “flex-1 min-h-0” (em vez de `h-full max-h[...]`)
   - Ainda no mesmo trecho do “Member Selection Dialog”:
     - Remover o wrapper que força `h-full` no ScrollArea.
     - Estrutura alvo:
       - Header: `flex-shrink-0`
       - Lista: `<ScrollArea className="flex-1 min-h-0 border rounded-md"> ... </ScrollArea>`
       - Footer: `flex-shrink-0`
   - Motivo: em flexbox, o padrão mais confiável para scroll interno é “flex-1 + min-h-0” no elemento scrollável. `h-full` costuma falhar quando o pai não tem altura computável.

3) Se ainda houver instabilidade, substituir Radix ScrollArea por overflow nativo (plano B simples e muito confiável)
   - Caso o Radix ScrollArea continue sem rolar por causa da combinação “Dialog dentro de Dialog” + estilos, substituir apenas a área rolável por:
     - `<div className="flex-1 min-h-0 overflow-y-auto border rounded-md"> ... </div>`
   - Motivo: `overflow-y-auto` nativo é o comportamento mais previsível em todos os browsers e dispositivos.

4) Ajuste de UX (pequeno, mas importante): evitar “duplo toggle” no clique
   - Hoje o item tem `onClick={() => toggleMember(...)}` e o Checkbox também chama `toggleMember`.
   - Ajustar para:
     - Ou deixar apenas o clique na linha (row) e no Checkbox apenas impedir propagação
     - Ou remover o onClick da linha e deixar só o checkbox
   - Isso não corrige o scroll, mas evita comportamento confuso ao tocar/clicar.

5) Critério de aceite (teste rápido)
   - Abrir: Departamento → Nova Escala → Selecionar Individual
   - Esperado:
     - A janela tem altura consistente.
     - A lista mostra parte dos nomes e permite rolar até o último membro (mouse wheel/trackpad no desktop e swipe no mobile).
     - Footer (“Selecionar Todos / Limpar / Confirmar”) permanece visível e não “sobe” junto com a lista.

</plan>

<files-to-change>
- `src/components/department/AddScheduleDialog.tsx`
</files-to-change>

<risks-and-notes>
- “Dialog dentro de Dialog” (Radix) às vezes cria interações estranhas com foco/scroll dependendo do layout. Por isso o Plano B (overflow nativo) está incluído: é simples e resolve 99% dos casos.
- Vamos manter z-index e backgrounds do dialog/menus conforme padrões do projeto para evitar “menus transparentes” e sobreposição estranha.
</risks-and-notes>
