## Objetivo

Três frentes:
1. **Vínculo LeviEscalas ↔ LeviKids** via departamento automático "Professores Kids".
2. **Paridade de líder**: trazer mural, disponibilidade, bloqueios e escala automática (IA) para o líder do LeviKids.
3. **Sessão por aba**: cada aba do navegador com login independente.

---

## 1. Departamento "Professores Kids" automático

Quando o líder ativa o LeviKids na igreja:

- Criar (ou reaproveitar) um departamento `Professores Kids` no LeviEscalas dessa igreja, marcado com uma flag nova `kids_linked = true` em `departments`.
- Sincronização de mão dupla no pool de professores:
  - Adicionar membro no dept "Professores Kids" (LeviEscalas) → cria linha em `kids_teacher_rooms` (pool, sem sala ainda) via trigger.
  - Adicionar professor pelo link `/kids/teacher-join` → cria linha em `members` do dept "Professores Kids" via trigger.
  - Remoção segue a mesma regra em ambos os lados.
- A **escala por sala/dia** (`kids_room_schedules`) continua exclusiva do LeviKids — LeviEscalas fica só como cadastro/pool.
- Proteções:
  - Só membros do dept "Professores Kids" (ou o líder Kids) enxergam a área do professor.
  - Dept "Professores Kids" não aceita autoinscrição por invite normal — só entra via link Kids ou o líder adiciona.

**UI**: aviso na aba "Escala" do KidsAdmin — "Este pool está sincronizado com o departamento Professores Kids no LeviEscalas" + link para o dept.

---

## 2. Paridade líder LeviKids ↔ LeviEscalas

Adicionar no `KidsAdmin` (visível ao líder Kids):

- **Mural de avisos** — nova aba "Avisos", reusa `department_announcements` filtrando pelo dept "Professores Kids". Push/popup segue o mesmo fluxo já existente do LeviEscalas.
- **Disponibilidade semanal do professor** — professor no `KidsDashboard` marca dias/turnos que pode servir; reusa `member_availability` do dept "Professores Kids". Aba nova "Minha disponibilidade" no KidsDashboard.
- **Datas de bloqueio** — mesmo padrão, reusa `member_date_availability`. UI no KidsDashboard.
- **Escala automática (IA)** — botão "Gerar escala do mês" na aba "Escala" do KidsAdmin. Nova edge function `kids-generate-smart-schedule` que:
  - Lê dias de aula (`kids_service_days`), salas ativas, pool de professores, disponibilidade semanal e bloqueios.
  - Distribui professores equilibradamente por sala/data em `kids_room_schedules`.
  - Respeita restrições (professor não escalado em dia bloqueado, prefere quem está livre naquele turno).

O líder Kids passa a ter o mesmo poder que um líder de dept comum, mas contido no escopo Kids.

---

## 3. Sessão isolada por aba

Trocar o storage do Supabase de `localStorage` para um wrapper que usa `sessionStorage`, com fallback compatível:

- Editar `src/integrations/supabase/client.ts` (única exceção — necessária) para passar um custom `storage` que:
  - Lê/escreve prioritariamente em `sessionStorage`.
  - Se `sessionStorage` estiver vazio no boot da aba, tenta hidratar **uma vez** de `localStorage` para preservar UX de sessões existentes; depois desliga a sincronização.
  - Escritas novas vão só para `sessionStorage`.
- Efeito: cada aba tem sua própria sessão; login em uma aba não muda a outra.
- Trade-offs comunicados ao usuário: fechar a aba desloga; "lembrar de mim" agora vale por aba. Biometria/WebAuthn continua funcionando pois é re-login rápido.

---

## 4. Alterações técnicas

**Backend (migration):**
- `ALTER TABLE departments ADD COLUMN kids_linked boolean DEFAULT false`.
- Função `ensure_kids_department(church_id)` — cria/retorna o dept "Professores Kids" com `kids_linked = true`, líder = líder Kids.
- Chamar `ensure_kids_department` dentro do fluxo de criação do `kids_pages`.
- Trigger `sync_kids_teacher_from_members` em `members` (INSERT/DELETE) restrito a `kids_linked` depts.
- Trigger `sync_kids_teacher_to_members` em `kids_teacher_rooms` (INSERT/DELETE do primeiro/último vínculo do user).
- Bloquear invite/join normal em depts `kids_linked` (policy + verificação em `JoinDepartment`).

**Edge function nova:**
- `supabase/functions/kids-generate-smart-schedule/index.ts` — IA (Lovable AI Gateway) monta escala do mês.

**Frontend:**
- `src/integrations/supabase/client.ts` — custom storage sessionStorage.
- `src/pages/kids/KidsAdmin.tsx` — abas "Avisos" e botão IA na Escala; banner de vínculo.
- `src/pages/kids/KidsDashboard.tsx` — aba "Minha disponibilidade" e "Meus bloqueios".
- Reusar componentes existentes: `AnnouncementBoard`, `MyAvailabilitySheet`, `LeaderBlackoutDatesView`, `SmartScheduleDialog` (passando o dept "Professores Kids").

---

## Perguntas rápidas antes de executar

1. O departamento "Professores Kids" deve **aparecer** na lista de departamentos do LeviEscalas do líder, ou fica **oculto** (só visível via LeviKids)?
2. Para escala automática Kids: **1 professor por sala/dia** ou **permitir 2+** (ex.: Berçário sempre com dupla)?