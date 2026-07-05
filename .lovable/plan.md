## Objetivo

Trazer "Minhas Escalas" para dentro do Dashboard, com cards menores, botão de troca reduzido ao ícone das setas (posicionado no lado oposto do dia), atalho no topo direito para "Escala da Equipe" e remover o item "Minhas Escalas" da sidebar.

## Mudanças

### 1. `src/pages/Dashboard.tsx` — embutir Minhas Escalas
- Buscar as próximas escalas do usuário logado (mesma consulta do modo `mine` de `MySchedules.tsx`) direto no Dashboard.
- Renderizar abaixo do bloco de perfil/departamentos uma seção "Próximas Escalas" com grid de cards **menores** (grid mais denso: `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`, padding e tipografia reduzidos).
- Cabeçalho da seção com título à esquerda e, **no topo direito**, um botão "Escala da Equipe" (ícone `Users` + label) que navega para `/my-schedules?view=team`.
- Exibir também as solicitações de troca pendentes destinadas ao usuário (reuso do bloco atual de `pendingSwapsForMe`) logo acima da grade.
- Se não houver escalas: manter mensagem discreta ("Nenhuma escala futura").

### 2. Botão "Pedir Troca" → ícone das setas no canto oposto ao dia
Aplicar em **todos os cards** de escala (Dashboard novo, `MySchedules.tsx` modo `mine` e modo `team`):
- Remover o bloco inferior com o botão largo "Pedir Troca" (`ArrowLeftRight` + texto + `w-full`).
- No cabeçalho colorido do card, onde hoje está o dia da semana + data à esquerda, adicionar no lado direito um `Button size="icon"` variant `ghost`, arredondado, contendo apenas `<ArrowLeftRight />`, com `aria-label="Pedir troca"` e `Tooltip` "Pedir troca".
- Se já existe um swap pendente para aquele agendamento, substituir o botão pelo `PendingSwapBadge` compacto (ícone-only quando possível) no mesmo canto.
- No modo team, o ícone só aparece quando o slot contém o próprio usuário (mesma regra atual).

### 3. Sidebar — remover atalho de Minhas Escalas
- Em `src/components/DashboardSidebar.tsx`, remover o `SidebarItem` da linha ~451 (`t('sidebar.mySchedules')` → `/my-schedules`).
- Manter o item que aponta para `/my-schedules?view=team` se existir (ou nenhum, já que o acesso ao team view passa a ser pelo botão no Dashboard).

## Fora de escopo
- A rota `/my-schedules` continua existindo (usada pelo botão "Escala da Equipe" e por links diretos); não é removida.
- Nenhuma alteração de lógica de swap, banco ou notificações.
