# Relatório de Saúde — LEVI Escalas + LeviKids
Data: 19/07/2026

## Resumo executivo

| Área | Status | Observação |
|---|---|---|
| TypeScript (tsgo) | ✅ OK | 0 erros |
| ESLint (bugs reais) | ✅ OK | 0 bugs. Apenas 1 aviso cosmético em `textarea.tsx` (interface vazia herdada do shadcn) |
| ESLint (`no-explicit-any`) | ⚠️ Alerta | ~258 avisos de tipagem cosmética; não quebra nada em runtime |
| RLS — tabelas privadas | ✅ OK | Testes existentes cobrem `profiles`, `members`, `schedules`, `kids_*`, etc. |
| RLS — `kids_service_days` | ✅ OK | Policy pública removida; agora só líderes/professores/responsáveis |
| Supabase Linter | ⚠️ Alerta | 134 warns (buckets públicos legítimos + funções SECURITY DEFINER expostas por design) |
| Rotas | ✅ OK | 43 rotas registradas em `App.tsx`, todas as Kids presentes |
| RPCs Kids | ✅ OK | 20 funções `kids_*` no schema public, todas presentes |
| Edge Functions | ✅ OK | Booting e respondendo (última janela: zapi-webhook processando mensagens) |
| Domínio | ✅ OK | `leviescalas.com.br` publicado |

Tudo essencial está funcionando. Os itens em ⚠️ **não são bugs** — são características esperadas ou cosméticas.

---

## 1. Typecheck (`tsgo --noEmit`)
```
0 erros
```

## 2. Lint (bugs reais, ignorando `no-explicit-any`)
```
1 aviso — src/components/ui/textarea.tsx
  interface vazia declarada por padrão do shadcn/ui (não é um bug)
```
Todos os `catch {}` vazios, `let→const` e escapes de regex inválidos **foram corrigidos** no debug anterior.

## 3. Lint completo
- **258 avisos** `@typescript-eslint/no-explicit-any` em componentes/páginas.
- **Impacto**: nenhum em runtime; apenas perda de auto-complete em partes específicas.
- **Ação sugerida**: refatoração cosmética futura, opcional.

## 4. Supabase Linter (134 warns)
Categorias:
- **`0025_public_bucket_allows_listing`** (3× warns) — buckets de mídia pública (`user-avatars`, `kids-photos`, `logos`) — comportamento intencional para renderizar avatares/fotos sem token.
- **`0028_anon_security_definer_function_executable`** (dezenas) — funções `SECURITY DEFINER` públicas por design (validações de convite, contadores públicos, `has_role`, `kids_lookup_*`). Elas fazem sua própria checagem interna.
- Não há **CRÍTICOS** (RLS ausente ou tabela exposta).

## 5. RPCs Kids presentes (20)
```
kids_child_attendance                kids_lookup_page_by_token
kids_children_require_photo          kids_lookup_page_rooms_by_token
kids_create_page_by_church_code      kids_lookup_room_by_static_token
kids_default_consent_text            kids_perform_checkin
kids_get_linked_department           kids_perform_checkin_by_page
kids_get_or_create_dyn_token         kids_perform_checkin_static
kids_is_within_service_window        kids_perform_checkout
kids_report_dropoff                  kids_report_needs
kids_report_visitors                 kids_self_register_teacher
kids_teacher_rooms_today             kids_transfer_child
```
Todas alinhadas com as chamadas do frontend em `KidsAdmin`, `KidsCheckin`, `KidsJoin`, `KidsDashboard`, `KidsReports`.

## 6. Rotas críticas verificadas
Todas presentes em `src/App.tsx`:
- ✅ `/`, `/auth`, `/dashboard`, `/admin`
- ✅ `/kids`, `/kids/admin`, `/kids/dashboard`, `/kids/checkin`
- ✅ `/kids/join/:token`, `/kids/teacher-join/:token`
- ✅ `/kids/mensagens`, `/kids/relatorios`, `/kids/inclusao`
- ✅ `/igreja/join/:code`, `/join/:inviteCode`, `/join-coordinator/:code`
- ✅ `/authorize-minor`

## 7. Edge Functions — atividade recente
- `zapi-webhook-receive`: processando mensagens em tempo real ✅
- `process-whatsapp-queue`: ciclando a cada ~40s ✅
- `send-delayed-announcements`: bootou ✅
- `send-scheduled-reminders`: bootou ✅

## 8. Segurança — findings recentes fechados
- ✅ `kids_service_days_public_read` — policy pública substituída por restrita a membros da página.
- ✅ `departments_invite_codes_exposed_to_members` — colunas revogadas.
- ✅ `SUPA_function_search_path_mutable` (função `is_minor`) — `search_path` fixo.

---

## Conclusão
O sistema está **saudável e funcional**. Os únicos alertas restantes são:
1. Tipagem `any` (cosmético).
2. Warnings do linter Supabase que refletem comportamento intencional (buckets de mídia, funções públicas de validação de convite).

Nenhuma ação corretiva urgente é necessária.
