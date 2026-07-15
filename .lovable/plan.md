## Plano LeviKids v2

Vou entregar as 7 frentes numa migração + código, respeitando o que já existe. Também corrijo 3 falhas de segurança relacionadas (kids_rooms, kids_pages) porque a nova modelagem exige.

### 1. Check-in com QR único + janela de horário
- Adicionar em `kids_pages`: `checkin_start_time` (time), `checkin_end_time` (time), `checkin_days` (int[] — dias da semana permitidos, ex `{0,3}` = domingo/quarta), `checkin_timezone` (default `America/Sao_Paulo`).
- Remover geração/expiração do QR rotativo. O `static_qr_token` da sala vira o único QR (impresso/colado na porta da sala).
- Nova RPC `kids_perform_checkin_static(_static_token, _child_ids)` que:
  - valida se `now()` está dentro da janela `checkin_start_time..checkin_end_time` no dia da semana permitido;
  - valida foto obrigatória (bloqueia se `photo_path IS NULL`);
  - valida guardião;
  - cria check-in normalmente.
- Depreciar `kids_perform_checkin` (dinâmico) e `kids_get_or_create_dyn_token`; manter tabela `kids_dynamic_tokens` por ora vazia (não quebra código legado).
- UI `KidsCheckin.tsx`: apontar câmera → lê `static_qr_token` → chama nova RPC. Mensagem clara quando fora do horário ("Check-in fecha às 20:00").
- UI `KidsDashboard.tsx`: substituir card "QR rotativo" por card "QR permanente da sala" com botão imprimir/baixar PNG.
- UI `KidsAdmin.tsx`: novo bloco "Horário de funcionamento" com time-pickers e checkboxes de dias.

### 2. Foto obrigatória no cadastro
- `kids_children.photo_path` passa a `NOT NULL` via trigger de validação (não CHECK) na inserção.
- UI `KidsJoin.tsx` / edição: campo de upload obrigatório, botão de check-in bloqueado enquanto falta foto (com aviso).

### 3. Transferência de sala pelo líder da página
- Adicionar coluna `kids_children.current_room_id` (uuid, nullable) — sala padrão.
- Nova RPC `kids_transfer_child(_child_id, _new_room_id)` restrita a `is_kids_leader`.
- Nova aba no `KidsAdmin.tsx`: lista de crianças com sala atual + botão "Transferir" (select de salas da mesma página).
- Histórico de transferências em `kids_room_transfers` (child_id, from_room, to_room, by_user, at).

### 4. Sala de Inclusão + assistente IA
- Marcar sala especial: coluna `kids_rooms.is_inclusion` (bool). No admin, checkbox "Sala de inclusão".
- Nova página `KidsInclusionAssistant.tsx` (rota `/kids/inclusao`) acessível a professores da sala de inclusão + líderes:
  - Lista as crianças presentes com `restrictions/allergies/observations`;
  - Botão "Pedir ideias à IA" → edge function `kids-inclusion-ai` usando **Lovable AI** (`google/gemini-3.5-flash`) que recebe perfil da criança (idade, restrições, observações — sem PII sensível) e devolve sugestões de atividades adaptadas (autismo, TDAH, etc.).
- Sem armazenar as respostas (opção de salvar como nota vinculada à criança em `kids_inclusion_notes` só se professor clicar "Salvar").

### 5. Histórico e frequência por criança
- View/RPC `kids_child_attendance(_child_id, _from, _to)` que retorna check-ins agregados: total, por mês, dias frequentados, sala.
- Aba "Histórico" no perfil da criança (dentro do fluxo do responsável e no admin do líder): tabela + mini-gráfico (Recharts bar por mês).

### 6. Relatórios de gestão (líder)
- Nova página `KidsReports.tsx` (rota `/kids/relatorios`, restrita a líder):
  - **Visitantes** (crianças com <3 check-ins nos últimos 90 dias);
  - **Necessidades específicas / restrições alimentares** (query em `kids_children` com `restrictions/allergies not null`);
  - **Desistência de famílias** ⭐ — crianças que tinham ≥3 check-ins em 60d atrás mas 0 nos últimos 30d, listando responsável + WhatsApp para o líder ligar;
  - Exportação CSV via `exceljs`.
- RPCs `kids_report_visitors`, `kids_report_needs`, `kids_report_dropoff`.

### 7. Comunicação com famílias durante a semana
- Nova tabela `kids_messages`: id, page_id, room_id (nullable = broadcast da página), sender_id, sender_role (`leader|teacher`), title, body, media_url (nullable), created_at.
- Professor envia apenas para pais da sua sala; líder envia para toda a página. RLS aplica isso.
- Guardiões leem via nova página `KidsFamilyFeed.tsx` (rota `/kids/mensagens`): lista mensagens das salas dos seus filhos + da página.
- Notificação WhatsApp opcional via `kids-notify-whatsapp` (event `family_message`) quando líder marcar "notificar".
- Upload de mídia (PDF/vídeo/imagem) num bucket privado `kids-messages`.

### 8. Correções de segurança (obrigatórias por causa da nova modelagem)
- Substituir política `kids_rooms read for authenticated USING (true)` por: leitura restrita a líder da página OU professor da sala. O check-in por QR não precisa mais dessa leitura pública porque a nova RPC é SECURITY DEFINER.
- Substituir política `kids_pages read for authenticated USING (true)` por: leitura restrita a líder/professor/guardião com criança na página. Slug público continua acessível via `kids_lookup_room_by_static_token` (já SECURITY DEFINER).

### 9. Limpeza / consistência
- Remover UI de rotação de QR do dashboard.
- Manter `kids_perform_checkin` legado por 1 release (marcar deprecated no comentário SQL).
- Regras LGPD: não pedir CPF (confirmado, seguimos sem).

---

### Detalhes técnicos

**Migração SQL (resumo — vai numa migração só):**
- ALTER `kids_pages` add `checkin_start_time`, `checkin_end_time`, `checkin_days int[] default '{0}'`, `checkin_timezone text default 'America/Sao_Paulo'`.
- ALTER `kids_rooms` add `is_inclusion bool default false`.
- ALTER `kids_children` add `current_room_id uuid references kids_rooms(id)`.
- Trigger `kids_children_require_photo` que RAISE se `photo_path IS NULL` on insert/update.
- CREATE TABLE `kids_room_transfers`, `kids_messages`, `kids_inclusion_notes` — cada uma com GRANT + RLS + policies.
- Funções: `kids_perform_checkin_static`, `kids_transfer_child`, `kids_child_attendance`, `kids_report_visitors`, `kids_report_needs`, `kids_report_dropoff` (todas `SECURITY DEFINER SET search_path = public`).
- DROP + CREATE policies em `kids_rooms` e `kids_pages` (fix de segurança).
- Storage: bucket privado `kids-messages` + policies.

**Edge function nova:**
- `kids-inclusion-ai` → Lovable AI Gateway (`LOVABLE_API_KEY` já existe), model `google/gemini-3.5-flash`, prompt em PT-BR pedindo 3-5 ideias práticas de atividade adaptadas ao perfil informado.

**Arquivos front:**
- Editar: `KidsCheckin.tsx`, `KidsDashboard.tsx`, `KidsAdmin.tsx`, `KidsJoin.tsx`, `useKidsPage.tsx`, `App.tsx` (rotas), `kidsAccess.ts`.
- Criar: `KidsInclusionAssistant.tsx`, `KidsReports.tsx`, `KidsFamilyFeed.tsx`, `KidsChildHistory.tsx` (componente), `RoomTransferDialog.tsx`.

**Fora do escopo (confirmado):** CPF do responsável.

---

Aprovando o plano, executo tudo (migração + funções + UI). Ordem: migração → edge function IA → UI. Ao final rodo `tsgo` e o linter de segurança.