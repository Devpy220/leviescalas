# Prompt-mestre de funcionalidades + verificação de saúde

## Objetivo
Entregar dois artefatos em uma única passada:

1. **PROMPT.md** — documento único, em português, descrevendo TODAS as funcionalidades do sistema (LEVI Escalas e LeviKids), no formato de "prompt de produto" (pode ser colado em qualquer LLM para recriar/entender o sistema).
2. **Relatório de verificação** — bateria de checagens automáticas mostrando o que está funcionando e o que tem alerta.

Nenhuma funcionalidade nova é criada. Nenhum comportamento é alterado.

---

## Parte 1 — PROMPT.md (documento de funcionalidades)

Arquivo criado na raiz do projeto (`PROMPT.md`), estruturado em seções:

### 1. Visão geral
- Identidade da marca, domínio oficial, público-alvo, dois módulos (Escalas + Kids).

### 2. LEVI Escalas — módulo principal
- **Autenticação**: cadastro só por convite, login e-mail/senha, 2FA opcional, WebAuthn (biometria), recuperação de senha, isolamento de sessão por aba.
- **Igrejas**: cadastro público com CNPJ, código único, link universal `/igreja/join/:code`, limpeza automática de igrejas inativas.
- **Departamentos**: criação, coordenadores, setores, papéis de atribuição customizáveis, convites por link.
- **Membros**: perfil, avatar, preferências, visibilidade de contato, blackout dates, disponibilidade semanal permanente + datas avulsas.
- **Escalas**: geração manual, geração inteligente por IA, edição, troca de escala (mutual + fluxo WhatsApp), confirmação, exportação, conflitos interdepartamentais bloqueados, restrição de domingo.
- **Repertório**: gestão de músicas por slot, cifras, YouTube.
- **Comunicação**: mural de avisos, popup de 15s, WhatsApp via Z-API (lembretes escalonados, trocas, avisos, broadcast admin), suporte 4×/mês.
- **Calendário**: sync iCal 3 meses.
- **Doações**: Stripe (cartão) + PIX manual.
- **Admin global**: métricas, broadcasts, gerenciamento de igrejas, links Kids.
- **PWA**: instalação Android/Desktop/iOS.

### 3. LeviKids — módulo infantil
- **Página Kids por igreja**: criação pelo líder ou pelo link universal.
- **Salas por idade**: definidas pela igreja, alocação automática por data de nascimento.
- **QR único da igreja**: check-in centralizado, sem código por sala.
- **Cadastro dos pais**: nome, e-mail, telefone, CPF, foto obrigatória da criança, data de nascimento obrigatória.
- **AgeGate**: bloqueio de menores de 18 sem autorização; fluxo de autorização por responsável.
- **Check-in/Check-out**: fluxo simplificado sem código de retirada; check-out por 1 clique do professor escalado.
- **Múltiplos dias de aula**: recorrentes ou datas avulsas.
- **Escala restritiva**: professor só acessa a sala em que está escalado no dia; geração automática por IA.
- **Departamento vinculado "Professores Kids"**: sincroniza membros ↔ pool de professores.
- **Comunicação**: mensagens segmentadas (líder/professor/família), feed familiar, WhatsApp.
- **Relatórios**: frequência, desistência.
- **Assistente de inclusão (IA Gemini)**.
- **Termo de consentimento LGPD** legível em claro/escuro.
- **Navegação cruzada** por ícones entre Kids ↔ Departamento.

### 4. Segurança e privacidade
- RLS em todas as tabelas críticas, GRANTs explícitos, mascaramento de PII, `has_role` security definer, isolamento por `is_department_member` / `is_kids_leader`, `search_path` fixo, invite codes nunca expostos a membros, sessões por aba.

### 5. Stack técnica
- React 18 + Vite + TS + Tailwind + shadcn, Supabase (Lovable Cloud), Edge Functions Deno, Z-API WhatsApp, Stripe, Lovable AI Gateway (Gemini).

### 6. Regras de UX/UI
- Violet-600 + Amber-400, LeviKidsWordmark colorido sempre, dark mode completo, ações em modais/sidebar (sem subpáginas), footer padrão.

---

## Parte 2 — Verificação de saúde

Rodada em paralelo, resultado consolidado em `HEALTH_REPORT.md`:

1. **Typecheck** (`tsgo --noEmit`) — passa sem erros.
2. **Lint** (`eslint --quiet`) — separando bugs reais (empty-block, prefer-const, useless-escape) dos avisos cosméticos (`no-explicit-any`).
3. **Knip** — dependências instaladas sem uso e exports órfãos.
4. **Supabase linter** — RLS ausente, functions sem `search_path`, buckets públicos.
5. **Testes RLS** existentes (`supabase/tests/rls.test.ts`) — confirma que anon não lê tabelas privadas nem RPCs sensíveis.
6. **Smoke check das RPCs Kids**: `kids_perform_checkin_by_page`, `kids_perform_checkout`, `has_kids_access`, `is_kids_leader`, `is_kids_teacher_of_page` — chamadas com JWT anônimo devem falhar; assinatura deve existir.
7. **Verificação de rotas críticas**: `/`, `/auth`, `/dashboard`, `/kids`, `/kids/admin`, `/kids/checkin/:token`, `/kids/join/:token`, `/igreja/join/:code` — checa que o componente existe e o import está resolvido.
8. **Edge functions** — lista as funções e destaca as que não têm log recente (podem estar ociosas ou quebradas).

O relatório termina com uma tabela **OK / Alerta / Falha** por área.

---

## Detalhes técnicos

- **Arquivos criados**: `PROMPT.md`, `HEALTH_REPORT.md` (raiz).
- **Nada é modificado** no código-fonte, migrations, ou config.
- Comandos executados são todos read-only (typecheck, lint, knip, linter Supabase, `SELECT` no banco).
- Se algum item da verificação vier vermelho, ele é apenas **listado** no relatório — a correção fica para uma próxima etapa que você aprovar separadamente.

## Fora de escopo

- Corrigir os 258 avisos `no-explicit-any`.
- Refatorar código legado.
- Alterar qualquer RLS, RPC ou edge function.
- Escrever testes novos.
