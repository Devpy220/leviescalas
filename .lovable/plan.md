# Assistente de Escalas com IA (Chat)

Adicionar um novo assistente conversacional para escalas, **sem remover** o gerador atual (Smart Schedule). O líder conversa em linguagem natural, a IA propõe a escala respeitando bloqueios e disponibilidades, e o líder revisa antes de salvar.

## Como funciona

1. Líder abre o novo FAB **"Assistente IA"** (ícone diferente do Sparkles atual, ex: `MessageSquareSparkles`) ao lado dos FABs existentes.
2. Abre um **drawer/dialog com chat**:
  - Líder escreve condições em texto livre. Ex:
    - *"Escala o mês inteiro, 3 pessoas por culto de domingo manhã"*
    - *"Evita escalar Maria com João no mesmo turno"*
    - *"Quem está pouco escalado este mês tem prioridade"*
    - *pode até ser por voz se possivel* 
  - IA responde, faz perguntas se preciso, e quando o líder confirma, gera a proposta.
3. **Tela de revisão** (mesma já usada pelo Smart Schedule atual): lista todos os slots propostos com membro + horário + dia. Líder pode:
  - Trocar membro slot a slot (dropdown com membros disponíveis)
  - Remover slot
  - Adicionar slot manual
  - **Confirmar e salvar** → grava em `schedules` (passa pelos triggers atuais).
4. Nada é salvo automaticamente.

## Garantias obrigatórias (a IA NÃO pode violar)

Antes da IA propor qualquer pessoa em um slot, o backend filtra a lista de candidatos elegíveis e só envia esses para a IA escolher. Filtros:

- **Bloqueios de dia** (`member_date_availability` — blackout dates) — exclui totalmente.
- **Disponibilidade semanal** (`member_availability`) — só elegível se disponível naquele dia/horário.
- **Conflitos cross-department** (mesmo horário em outro depto) — exclui.
- **Exclusividade de domingo** (regra `allow_sunday_double`) — exclui se já escalado no outro turno.
- **Membro já escalado no mesmo slot** — exclui.

A IA recebe a lista pré-filtrada + contagem de escalas no mês de cada membro, e escolhe respeitando as condições do líder. Pode **sugerir membros pouco escalados** quando o líder pedir "balancear".

## Arquivos

**Novos:**

- `supabase/functions/ai-schedule-assistant/index.ts` — edge function com:
  - Conversa multi-turno (recebe histórico de mensagens)
  - Quando o líder confirma geração: monta contexto (slots fixos do depto, membros, blackouts, disponibilidades, contagem atual de escalas), pré-filtra candidatos elegíveis por slot, chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool calling (`Output.object` retornando array de `{date, time_start, time_end, user_id, slot_label}`)
  - Valida resposta da IA contra os candidatos elegíveis (rejeita qualquer user_id fora da lista) e retorna proposta
- `src/components/department/AiAssistantDialog.tsx` — drawer com:
  - Chat (`message.parts`, markdown, scroll automático, textarea com focus)
  - Estado: `idle` → `chatting` → `generating` → `reviewing`
  - Tela de revisão reutilizando `SchedulePreviewList` (extrair do `SmartScheduleDialog` se útil, ou inline)
  - Ao confirmar, faz `supabase.from('schedules').insert([...])` em lote

**Editados:**

- `src/components/department/UnifiedScheduleView.tsx` — adicionar 3º FAB "Assistente IA" abaixo dos 2 existentes
- `src/pages/Department.tsx` — wire-up do novo dialog
- `src/i18n/locales/{pt,en,es}.json` — strings do novo assistente

**Não mexer:** `SmartScheduleDialog.tsx`, `generate-smart-schedule`, schema do banco (sem migração nova).

## Modelo & custos

- Lovable AI Gateway, modelo `google/gemini-3-flash-preview` (rápido e barato).
- `LOVABLE_API_KEY` já existe.
- Tratar erros 429/402 da gateway com toast claro.

## Fora do escopo

- Salvar histórico de conversas (cada abertura começa nova conversa em memória).
- Mexer no Smart Schedule existente.
- Mudar regras de negócio ou banco.