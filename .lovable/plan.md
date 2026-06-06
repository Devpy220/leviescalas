## O que vai mudar

### 1. Nova função "Ministro de Louvor"
Adiciono `worship_minister` em `src/lib/constants.ts` (ao lado de Plantão e Culto). Disponível em todo departamento — quem for marcado nessa função em uma escala ganha permissão de editar o Repertório de Hoje daquela escala.

### 2. Repertório de Hoje (unificado)
Hoje existem dois blocos separados: **"Repertório de Hoje"** (texto livre + links) e **"Setlist da Escala"** (lista ordenada de músicas com cifra, tom, BPM). Vou juntar tudo em **um único bloco "Repertório de Hoje"** dentro de cada slot do dia, contendo:

- Lista ordenada de músicas (arrastar para reordenar, com tom/BPM/link)
- Anexos PDF (cifras, ordem do culto) — upload direto no slot
- Campo livre de observações/links

Quem pode editar:
- Líder do departamento (sempre)
- Voluntário escalado naquele slot **com função "Ministro de Louvor"**
- Demais voluntários escalados: somente leitura

Editável apenas no slot da escala daquele dia (continua igual — já é por slot).

Remoção: `ScheduleSetlistManager.tsx`, tabela `escala_repertorio`, edge helper `setlistMessage.ts` (substituído pelo `slotNotesMessage` ampliado).

### 3. Biblioteca de Repertório (departamento)
- Botão **"Buscar no YouTube"** ao lado do título da música — abre `youtube.com/results?search_query=<título>` em nova aba
- Texto de ajuda do campo de link reforça que aceita YouTube, Spotify, Deezer, Apple Music, YouTube Music, Drive, PDF, etc.
- Upload de **PDF de cifra** direto no item da biblioteca (bucket público `repertoire-files`)

### 4. Notificação WhatsApp
A mensagem da escala e os lembretes passam a montar o bloco **"🎤 Repertório de Hoje"** com: lista de músicas + links das cifras (PDF) + observações. Tudo num único bloco copiável.

## Detalhes técnicos

**Migration:**
- `slot_notes`: adicionar `setlist jsonb DEFAULT '[]'` (itens `{title, url, tom, bpm, repertorio_id?}`) e `attachments jsonb DEFAULT '[]'` (`{name, url, size}`)
- `repertorio`: adicionar `pdf_url text`
- Buckets públicos: `slot-attachments`, `repertoire-files`
- Drop tabela `escala_repertorio` (não mais usada)
- Política RLS de `slot_notes` UPDATE/INSERT atualizada: permite ao líder OU a quem está escalado naquele slot com `assignment_role = 'worship_minister'`

**Frontend:**
- Renomear `SlotNotesEditor` para `SlotRepertoireEditor` com 3 seções (setlist / anexos / observações)
- `UnifiedScheduleView` calcula `canEditRepertoire` consultando `assignment_role` do schedule do usuário no slot
- Remover bloco "Setlist" de `EditScheduleDialog` e da página `MySchedules`
- `RepertoireView`: botão YouTube + upload PDF

**Edge functions:**
- `slotNotesMessage.ts` lê `setlist` + `attachments` + `content` e formata bloco único
- `send-schedule-notification` e `send-scheduled-reminders` deixam de chamar `fetchSetlistBlock`

Sem mudanças em outras telas.