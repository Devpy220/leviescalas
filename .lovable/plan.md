
# Coordenador do Departamento (somente leitura)

Novo papel **coordenador** por departamento: acessa apenas a visualização de escalas (datas, horários e nomes escalados), sem editar nada, sem receber WhatsApp/lembretes, sem aparecer em escalas, disponibilidades, avisos ou configurações. Entra via link de convite separado gerado pelo líder. Se já tem conta, só faz login. Se está em mais de 1 departamento (como membro, líder ou coordenador), escolhe qual acessar — já é o fluxo atual do `/dashboard`.

## 1. Banco de dados

Nova tabela `department_coordinators` (separada de `members` para não poluir RLS existente e não disparar gatilhos de notificação/escala):

- `id`, `department_id`, `user_id`, `invited_by`, `created_at`
- Unique `(department_id, user_id)`
- GRANTs para `authenticated` e `service_role`
- RLS:
  - Líder do depto: full manage
  - Próprio coordenador: SELECT da sua linha
  - DELETE próprio (sair)

Nova coluna em `departments`:
- `coordinator_invite_code text` (gerado on-the-fly via `gen_random_bytes`, separado do `invite_code` de membro)

Funções SECURITY DEFINER:
- `is_department_coordinator(_user_id, _department_id) returns boolean`
- `get_my_department_count` → atualizar para incluir coordenadorias
- `join_department_as_coordinator(code text)` — valida código, insere em `department_coordinators`, retorna `{success, department_id, department_name}`
- `validate_coordinator_code_secure(code text)` — análogo ao `validate_invite_code_secure`, com rate limit

Atualizar policies de leitura para liberar coordenador:
- `schedules` SELECT: adicionar `OR is_department_coordinator(auth.uid(), department_id)`
- `members` SELECT (para exibir nomes/avatars nas escalas): idem
- `assignment_roles` SELECT: idem
- `sectors` SELECT: idem
- `departments` (via `get_department_basic`): permitir coordenador

**Importante**: nenhum policy de INSERT/UPDATE/DELETE será estendido ao coordenador. `get_department_contacts`, `member_availability`, `member_preferences`, `department_announcements`, `notifications`, `member_date_availability` continuam bloqueados.

## 2. Edge functions / notificações

Nada novo. Verificações para **excluir coordenadores** dos disparos:
- `send-scheduled-reminders`, `auto-notify-schedule`, `send-announcement-notification`, `send-blackout-collection-prompt`, swap flow — todos já consultam `members` ou `schedules` por `user_id`. Como coordenador não vira `member` nem aparece em `schedules`, não recebe nada automaticamente. Sem mudança necessária.

## 3. Frontend

**a) Modal de convite (`InviteMemberDialog.tsx`)**
- Adicionar seletor de papel no topo: `Membro` | `Coordenador` (Tabs ou RadioGroup)
- Membro → mostra link atual `/join/:invite_code` (sem mudança)
- Coordenador → mostra link `/join-coordinator/:coordinator_invite_code` com texto explicativo: "Acesso somente leitura às escalas. Não recebe notificações."
- Botão "Gerar novo link" para regenerar `coordinator_invite_code` (chama RPC)

**b) Nova rota `/join-coordinator/:code` (`JoinCoordinator.tsx`)**
- Se não autenticado → redireciona a `/auth?redirect=/join-coordinator/:code` (mantém código no retorno)
- Se autenticado → chama `join_department_as_coordinator`, mostra toast e redireciona ao `/department/:id`
- Análogo ao `JoinDepartment.tsx`

**c) `useUserDepartments`**
- Buscar também `department_coordinators` do usuário e adicionar como `role: 'coordinator'`
- Tipo `UserDepartment.role` passa a aceitar `'leader' | 'member' | 'coordinator'`

**d) Dashboard / DepartmentPicker**
- Card de departamento mostra badge "Coordenador" quando aplicável
- Seleção continua igual (já lida com múltiplos depts)

**e) `Department.tsx` (e `DepartmentBySlug.tsx`)**
- Detectar papel: se coordenador, renderizar apenas `UnifiedScheduleView` em modo somente-leitura
- Ocultar: sidebar de ações (gerar escala, manual, avisos, membros, disponibilidades, configurações, FABs)
- Ocultar dropdowns de editar/excluir/troca em cada escala
- Header mostra badge "Coordenador — somente leitura"

**f) `UnifiedScheduleView` / `EditScheduleDialog` / swap dialogs**
- Receber prop `readOnly` (default false). Quando true: sem botões de ação, sem clique em escala abrir edição.

**g) `MemberList`, `MyAvailabilitySheet`, `LeaderBlackoutDatesView`, `AnnouncementBoard`, `SmartScheduleDialog`, `AddScheduleDialog`**
- Não renderizados para coordenador (gated em `Department.tsx`)

## 4. Itens fora de escopo

- Coordenador não conta como assento de assinatura (`update-subscription-quantity` continua olhando `members`)
- Coordenador não aparece em "Minhas Escalas" (`MySchedules.tsx`) — ele não tem escalas
- Nenhum envio de WhatsApp/email automático ao convidar (link copiado manualmente, como hoje)

## 5. Arquivos tocados

Migração SQL única (tabela + coluna + funções + policies estendidas).

Código:
- `src/components/department/InviteMemberDialog.tsx` — seletor de papel + link de coordenador
- `src/pages/JoinCoordinator.tsx` — **novo**
- `src/App.tsx` — registrar rota `/join-coordinator/:code`
- `src/hooks/useUserDepartments.tsx` — incluir coordenadorias
- `src/pages/Department.tsx` — gate de coordenador + modo readonly
- `src/pages/DepartmentBySlug.tsx` — idem (resolve slug → id, mesma lógica)
- `src/components/department/UnifiedScheduleView.tsx` — prop `readOnly`
- `src/components/Dashboard.tsx` (`src/pages/Dashboard.tsx`) — badge "Coordenador" no card

Sem alterações em edge functions, sem mudanças em fluxos de notificação.
