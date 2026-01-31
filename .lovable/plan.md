
<context>
Você já consegue rolar a lista de membros (ótimo). O problema agora é na etapa “Configurar Membros”: quando você seleciona 3 pessoas, só 1 (geralmente o último) consegue abrir o seletor de Setor/Função; nos outros “não abre”.

Pelo código atual em `src/components/department/AddScheduleDialog.tsx`, cada membro renderiza dois componentes Radix Select (Setor e Função) dentro de uma lista rolável. Em alguns cenários (principalmente dentro de Dialog + área com overflow), o menu do Select pode ficar “por trás” de alguma camada/overlay ou acabar abrindo fora da área visível, parecendo que “não abre”. Como você relatou que só 1 abre, isso sugere um conflito de camadas/interação no layout atual.

Você também disse que prefere “Editar em janela por membro” — isso é excelente porque elimina o problema de múltiplos Selects competindo dentro da mesma lista rolável e deixa o fluxo mais claro.
</context>

<goal>
1) Permitir configurar Setor/Função para TODOS os membros selecionados.
2) Trocar a experiência de “muitos selects na lista” por “editar um membro por vez em uma janela (dialog)”, com salvar/confirmar.
3) Fortalecer a camada do dropdown (z-index / pointer-events) para evitar problemas semelhantes em outras telas.
</goal>

<design>
Nova UX (na etapa “Configurar Membros”):
- A lista mostra cada membro com um resumo do que foi escolhido:
  - “Setor: X” e “Função: Y” (ou “Nenhum”)
  - Botão “Editar”
- Ao clicar “Editar” em um membro, abre um Dialog (janela) com:
  - Select de Setor
  - Select de Função
  - Botões: Cancelar / Salvar
- Ao salvar, atualiza `memberConfigs[userId]` e volta para a lista.

Opcional (qualidade de vida):
- Botão “Aplicar Setor para todos” e/ou “Aplicar Função para todos” dentro da janela, se você quiser acelerar quando muitos terão o mesmo setor/função.
</design>

<implementation_plan>
1) Ajustar o componente de Select para garantir que o menu sempre fique acima de dialogs e áreas com overflow
   - Arquivo: `src/components/ui/select.tsx`
   - Mudança:
     - Aumentar o z-index do `SelectContent` (ex.: de `z-50` para `z-[100]`).
     - Garantir `pointer-events-auto` no Content/Viewport se necessário (padrão que costuma resolver casos onde o menu “abre mas não interage” ou “parece não abrir” por camada).
   - Motivo:
     - Mesmo que a gente vá reduzir o uso de Selects na lista, isso previne problemas em outras partes do app e deixa o comportamento mais confiável.

2) Refatorar a etapa “Configurar Membros” para não renderizar Selects inline em cada card
   - Arquivo: `src/components/department/AddScheduleDialog.tsx`
   - Substituir os Selects inline por:
     - Exibição “somente leitura” do Setor/Função atuais daquele membro
     - Botão “Editar” por membro

3) Criar estado para controlar “qual membro está sendo editado”
   - Ainda em `AddScheduleDialog.tsx`:
     - `const [editingMemberId, setEditingMemberId] = useState<string | null>(null);`
     - `const isConfigDialogOpen = editingMemberId !== null;`

4) Implementar “Dialog de Edição do Membro” (janela por membro)
   - Dentro do mesmo arquivo (para manter simples) ou extraindo para um componente pequeno (se o arquivo já estiver grande demais):
     - `<Dialog open={isConfigDialogOpen} onOpenChange={(open) => !open && setEditingMemberId(null)}>`
     - Conteúdo:
       - Nome + avatar do membro
       - Select Setor (usa `sectors`)
       - Select Função (usa `ASSIGNMENT_ROLES`)
       - Botões: Cancelar / Salvar
   - Estratégia de edição (importante para evitar bugs):
     - Ao abrir a janela, carregar valores atuais de `memberConfigs[editingMemberId]` para estados locais (ex.: `localSectorId`, `localRole`).
     - Só ao clicar “Salvar”, chamar `updateMemberConfig(editingMemberId, ...)` e fechar.
   - Motivo:
     - Evita que o Select falhe dentro da lista rolável e evita qualquer “mistura” entre configurações.

5) (Opcional, mas recomendado) Botões de ação rápida
   - Dentro do Dialog de edição:
     - “Aplicar este Setor a todos”
     - “Aplicar esta Função a todos”
   - Implementação:
     - Percorrer `selectedMembers` e setar `memberConfigs` em lote.
   - Isso atende seu pedido de “colocar o setor depois confirmasse na escala um por um”, mas sem te obrigar a repetir trabalho quando vários terão a mesma configuração.

6) Critérios de aceite / testes
   - Cenário 1: selecionar 3 membros
     - Ir para “Configurar Membros”
     - Clicar “Editar” no primeiro → escolher Setor e Função → Salvar
     - Repetir no segundo e terceiro
     - Confirmar que cada um mantém seu próprio Setor/Função (não troca o do outro).
   - Cenário 2: muitos membros (8+)
     - A lista deve continuar rolando normal
     - O botão “Editar” deve funcionar em qualquer membro (topo, meio, fim)
   - Cenário 3 (mobile):
     - Abrir “Editar” e conseguir selecionar opções e salvar sem travar
</implementation_plan>

<files_involved>
- `src/components/department/AddScheduleDialog.tsx` (mudança principal do fluxo e criação do dialog por membro)
- `src/components/ui/select.tsx` (ajuste de z-index/pointer-events para tornar dropdown mais robusto)
</files_involved>

<notes_on_root_cause>
O problema “só um Select abre” normalmente vem de combinação de:
- Dialog (overlay/focus-lock) + elementos com overflow + componentes que usam Portal/Popper
- z-index igual ao overlay (ex.: z-50 em tudo) fazendo o menu ficar atrás
- área rolável capturando eventos e “matando” o click/scroll do dropdown
A solução de “janela por membro” elimina a maior parte desses conflitos e melhora a clareza do fluxo para o usuário final.
