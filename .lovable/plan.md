## Objetivo

1. Configurar **múltiplos dias de aula** (recorrentes semanais + datas avulsas) para a página LeviKids inteira, editáveis.
2. Criar **escala interna do LeviKids**: líder marca semanalmente quem serve em qual sala em qual data. O QR/link de check-in só funciona (e o dashboard só mostra a sala) para professores escalados **naquele dia**.

---

## 1. Dias de aula (página inteira)

**Nova tabela `kids_service_days**` — vinculada a `kids_pages`, cobre os dois formatos:

- Recorrente: `weekday` (0-6) + `time_start` + `time_end` + `active`.
- Avulso: `specific_date` + `time_start` + `time_end` + `active`.
- Cada linha editável/removível independentemente.

**Substitui** a janela única atual em `kids_pages` (`checkin_window_start/end`). A validação de "está dentro do horário de check-in?" passa a considerar qualquer linha ativa para o dia atual (recorrente do weekday **ou** avulsa da data).

**UI** — nova aba "Dias de aula" no `KidsAdmin`:

- Lista recorrentes (com dia da semana + horário) com editar/remover.
- Lista datas avulsas com editar/remover.
- Botão "Adicionar dia recorrente" e "Adicionar data avulsa".

---

## 2. Escala interna de professores por sala/data

**Nova tabela `kids_room_schedules**`:

- `room_id`, `user_id` (professor), `service_date` (data específica).
- Um professor pode estar escalado em várias salas em datas diferentes.
- Só líder do LeviKids pode inserir/editar/remover.

**Regra de acesso**:

- `kids_teacher_rooms` continua registrando as salas em que o professor **pode servir** (pool geral, via link `/kids/teacher-join`).
- Mas o **acesso efetivo à sala no dashboard** e a validação de check-out passam a exigir uma linha em `kids_room_schedules` para `hoje` + `user_id` + `room_id`.
- Se professor não escalado hoje → não aparece a sala no `KidsDashboard`, o botão de retirada é bloqueado no RPC.

**UI — nova aba "Escala de professores" no `KidsAdmin**` (visível ao líder):

- Seleciona uma data (default: próximo dia de aula).
- Para cada sala, líder escolhe entre os professores do pool (`kids_teacher_rooms`) quem serve naquele dia.
- Salvar cria/atualiza linhas em `kids_room_schedules`.
- Botão "copiar da semana anterior" para agilizar.

**Dashboard do professor (`KidsDashboard`)**:

- `loadRooms` filtra: só mostra salas onde há linha em `kids_room_schedules` para `user_id = eu` e `service_date = hoje`.
- Se não estiver escalado hoje: mensagem "Você não está escalado em nenhuma sala hoje."

---

## 3. Integração com LeviEscalas (departamento único "Professores Kids")

 cria vínculo automático agora. A escala do LeviKids é independente do departamento de escalas do LeviEscalas (por sua escolha). Se quiser sincronizar no futuro, mantemos aberto para uma etapa 2, mas tem cuidado para que outro integranates do levi não autorizados entr no levi kids

 Sugestão: adicionar um botão "Importar voluntários de um departamento" na aba de escala de professores, que lista membros de um departamento LeviEscalas escolhido e permite importar em lote como professores (`kids_teacher_rooms`). Isto é opcional — confirme se quer incluir agora.

---

## 4. Alterações técnicas

**Backend (migration):**

- `CREATE TABLE kids_service_days (id, page_id, weekday nullable, specific_date nullable, time_start, time_end, active, ...)` + GRANTs + RLS (líder gerencia; qualquer autenticado lê para validar check-in).
- Migrar janela atual de `kids_pages` para uma linha recorrente equivalente.
- `CREATE TABLE kids_room_schedules (id, room_id, user_id, service_date, ...)` + GRANTs + RLS (líder gerencia; professor lê a própria escala).
- Atualizar `kids_perform_checkin_static` / `kids_perform_checkin_by_page`: validar horário contra `kids_service_days` do dia.
- Atualizar `kids_perform_checkout` e `is_kids_teacher_of_room` (ou criar `is_kids_teacher_of_room_today`): exigir escala do dia.
- Nova RPC `kids_list_teacher_rooms_today()` para o dashboard.

**Frontend:**

- `KidsAdmin.tsx`: 2 novas abas ("Dias de aula", "Escala de professores").
- `KidsDashboard.tsx`: usa nova RPC para listar apenas salas do dia.
- `KidsJoin.tsx` / check-in dos pais: a mensagem de "fora do horário" agora considera a nova tabela.

---

## Perguntas rápidas antes de implementar

1. Incluir o botão "importar voluntários do departamento LeviEscalas" na escala de professores agora, ou deixar para depois?
2. Na escala de professores, permitir **múltiplos** professores por sala na mesma data (ex.: 2 professores no Berçário)?