# LEVI Escalas + LeviKids — Prompt-Mestre de Funcionalidades

> Documento único, em português, que descreve **tudo** o que o sistema faz hoje. Pode ser colado em qualquer LLM para entender, replicar ou estender o produto.

---

## 1. Visão geral

- **Produto**: plataforma SaaS para gestão de escalas de voluntários em igrejas + módulo de ministério infantil.
- **Domínio oficial**: `leviescalas.com.br`.
- **Marca**: LEVI (violet-600 + amber-400) e **LeviKids** (wordmark colorido letra a letra, sempre usado).
- **Dois módulos integrados**:
  1. **LEVI Escalas** — escalas de departamentos (louvor, mídia, recepção, etc.).
  2. **LeviKids** — check-in/check-out infantil por idade, com salas virtuais e escala restritiva.
- **Público**: líderes, coordenadores, voluntários adultos, professores kids, pais/responsáveis.

---

## 2. LEVI Escalas — módulo principal

### 2.1 Autenticação e conta
- Cadastro **estritamente por convite** (`/join?code=...`, `/igreja/join/:code`, `/join/:inviteCode`).
- Login e-mail + senha, sem Google/Apple/OAuth social.
- Recuperação de senha com refresh de sessão antes de atualizar.
- **2FA opcional** (TOTP) — setup e verificação próprios.
- **WebAuthn / biometria** (Face ID, Touch ID, digital) como complemento ao login por senha.
- **AgeGate**: data de nascimento obrigatória no primeiro login; menores de 18 bloqueados até que um responsável (18+) autorize via `/authorize-minor`.
- **Sessões isoladas por aba** (armazenamento em `sessionStorage`) — permite logar contas diferentes em abas paralelas sem colisão.
- Log silencioso em `login_logs` a cada login (visível só ao admin global).

### 2.2 Igrejas
- Cadastro público em `/church-setup` com **CNPJ validado** e prevenção de duplicidade (trigger em nome+endereço+cidade+UF).
- Cada igreja recebe um **código único**; o link universal `/igreja/join/:code` é o único link que a igreja distribui.
- Ao entrar pelo link, o usuário escolhe: **Criar departamento** (LEVI Escalas) e/ou **Criar página LeviKids**.
- **Auto-leader**: o primeiro usuário que reivindica o código vira `leader_id` da igreja (`claim_church_leadership` RPC).
- Página pública em `/igreja/:slug` mostra os departamentos e um calendário unificado (sem PII do registrante).
- Limpeza automática de igrejas inativas após 5 dias.

### 2.3 Departamentos
- Criação em `/departments/new` (alias `/novo-departamento`).
- Papéis: líder (auto no join), coordenadores adicionais, membros.
- **Setores** e **assignment roles** totalmente editáveis por departamento (nome, ícone, cor).
- Convites por link separado para membros e para coordenadores.
- `invite_code` e `coordinator_invite_code` **nunca são expostos** a membros comuns (RLS + revoke de colunas).
- Configurações do departamento em modal/sheet lateral — **nada abre subpágina**.

### 2.4 Membros e disponibilidade
- Perfil com avatar circular (bucket `user-avatars`), preferências, visibilidade de contato (phone/email) togglável.
- **Disponibilidade semanal permanente** (não reseta por mês; opt-out).
- **Disponibilidade por data avulsa** e **blackout dates** com limite configurável (`max_blackout_dates`).
- Slots fixos de domingo com nomes canônicos (`08:00–12:00`, `18:00–22:00`).
- Visualização do líder integra availability + blackout em `LeaderBlackoutDatesView`.

### 2.5 Escalas
- **Geração manual** com multi-select ("Escalar todos") e quick-fill.
- **Geração inteligente por IA** (`generate-smart-schedule` edge function) — mês inteiro por padrão, com toggles para excluir slots específicos.
- **Edição** com validação em tempo real da disponibilidade.
- **Confirmação por voluntário** via link/token (`/confirm/:token`).
- **Troca de escala mutual** com aprovação de ambos (função PG atômica).
- **Fluxo de troca por WhatsApp**: enviar "troca" abre menu numerado; máx. 3 retentativas antes de notificar líder.
- **Bloqueio interdepartamental**: trigger impede o mesmo voluntário em horários conflitantes em departamentos diferentes.
- **Regra de domingo exclusivo**: `allow_sunday_double` restringe duplas escalas ao domingo.
- **Views**:
  - `UnifiedScheduleView` (grid horizontal, até 3 turnos lado a lado no desktop).
  - `PersonalScheduleCard` agrupado por dia/turno, com destaque verde no próprio turno.
  - `?view=team` na URL alterna para visão de equipe.
- **FABs flutuantes**: IA (sparks) + manual (calendar+) canto inferior direito.
- **Exportação** via `exceljs` (nunca `xlsx`, por CVE).

### 2.6 Repertório
- Músicas por slot com cifras (`CipherViewer`), YouTube embed (id via `getYouTubeId`).
- Editor por slot; leitura por qualquer membro do departamento.

### 2.7 Comunicação (canal exclusivo: WhatsApp via Z-API)
- **Mural de avisos** com popup de 15 s (ativo 3 h) e notificação WhatsApp com delay de 30 min.
- **Lembretes escalonados** de escala (48/16h, 36/10h, 24/6h — por ordem de criação do dept).
- Formato objetivo: "Depto, dia, data, horário".
- **Broadcast admin global** via `send-admin-broadcast` (HTML card com link).
- **Mensagens de suporte** WhatsApp 4×/mês com PIX em texto.
- **Sem push, sem Telegram, sem e-mail** para notificações.

### 2.8 Calendário e integrações
- **Sync iCal (.ics)** — 3 meses passado + futuro, via `calendar_sync_tokens`.
- **Cakto** para pagamentos (offers/products/webhook).
- **Stripe Checkout** para doações públicas em BRL.
- **PIX manual** por QR code (fora de gateway).

### 2.9 Admin global
- E-mail admin: `elsdigital@elsdigital.tech` (função SQL garante o role).
- Painel em `/admin` com:
  - Métricas (`page_views` via AreaChart).
  - Broadcasts.
  - Auditoria de acesso a billing e profile.
  - Lista de igrejas com logo/nome e **link universal LeviKids** para copiar.
  - `Lighthouse` report card.
- Admin **não** é forçado para `/dashboard` quando está em `/igreja/*` ou `/join/*`.

### 2.10 PWA
- Instalação automática Android/Desktop após 4 s.
- iOS: modal visual manual na primeira visita.
- SW próprio (`public/sw.js`), handlers de push (`public/push-handlers.js`).

### 2.11 UI/UX
- **SaaS Premium**: violet-600 primário, amber-400 secundário, rounded-3xl, sombras profundas, glassmorphism nos modais.
- Fundo branco puro no tema claro.
- Sidebar semântica com categorias (`bg-sidebar`, estado persistente).
- Ações contextuais via **modais/sheets** — nunca subpáginas.
- Cores de membro: 12 cores fixas por hash do ID (avatares/iniciais).
- Landing: dot-grid, gradient blobs, `FeatureCarousel`, cubo 3D, `glowPulse`, botão colorido **LeviKids** em destaque.
- Login inline na home; página `/auth` foca em fluxos de convite e cadastro novo.

---

## 3. LeviKids — módulo infantil

### 3.1 Criação e acesso
- Uma **página Kids por igreja** (`kids_pages`).
- Criada pelo líder da igreja (via link universal `/igreja/join/:code` ou pelo painel admin global).
- Igrejas antigas: o admin envia o link `/kids/admin`; **não** há botão auto-serviço para elas.
- Card colorido no Dashboard do líder leva direto ao painel Kids (com re-validação de role no clique).
- Botões de ícone (copiar link + abrir painel) tanto no Dashboard quanto na Landing Kids.

### 3.2 Salas por idade
- Cada igreja define suas salas (`kids_rooms`) com faixa etária.
- **Alocação automática** por data de nascimento: `kids_perform_checkin_by_page` distribui a criança na sala correta.
- Salas podem ser desativadas ou apagadas pelo líder no `KidsAdmin`.

### 3.3 QR único da igreja
- **Um único QR** por igreja (não por sala).
- Baixável em card no topo da aba "Salas" do `KidsAdmin`.
- Ao escanear, o app: (a) valida se há dia de aula ativo (`kids_service_days` + `kids_is_within_service_window`); (b) redireciona não-cadastrado para `/kids/join/:token`; (c) faz check-in dos filhos vinculados.

### 3.4 Dias de aula
- `kids_service_days` suporta:
  - **Recorrentes** por dia da semana (`weekday`).
  - **Datas avulsas** (`specific_date`).
- Cada dia tem janela horária editável.
- Aba "Dias" no `KidsAdmin`.
- RLS: só líderes, professores e responsáveis da página leem (finding `kids_service_days_public_read` corrigido).

### 3.5 Cadastro dos pais/responsáveis
- Formulário em `/kids/join/:token` com **CPF obrigatório**, nome, e-mail, telefone.
- Cada filho: nome, **foto obrigatória**, data de nascimento obrigatória.
- `InlineAuth` embutido cria conta na mesma página usando o token da igreja como convite (sem passar por `/auth`).
- Termo de consentimento LGPD em `text-foreground` (legível em claro e escuro).

### 3.6 Professores
- Auto-cadastro por link reutilizável (`/kids/teacher-join/:token`) — cria via `kids_self_register_teacher`.
- Menores de 18 bloqueados pelo AgeGate.
- Aba "Professores" no `KidsAdmin` com o link para copiar.

### 3.7 Escala restritiva
- `kids_room_schedules` define quem serve em cada sala em cada data.
- Professor **só vê e opera** as salas em que está escalado no dia (`kids_teacher_rooms_today`).
- Check-out bloqueado pela RPC se professor não está na escala.
- **Geração automática por IA** via edge function `kids-generate-smart-schedule` (balanceia carga mensal, evita repetir professor no mesmo dia).

### 3.8 Departamento vinculado "Professores Kids"
- Trigger SQL garante 1 departamento com `kids_linked = true` por página Kids.
- Membros do departamento = pool de professores (sincronizado).
- Permite usar mural de avisos, disponibilidade e blackout do LEVI Escalas para o time Kids.
- Banner no `KidsAdmin` linka para o dept vinculado; botões de ícone para navegação cruzada Kids ↔ Dept.

### 3.9 Check-in / Check-out
- **Sem código de retirada** (removido por decisão do produto).
- Check-in: pais escaneiam QR → apps aloca por idade → status "Check-in ativo".
- Check-out: professor escalado confirma com **1 clique**.
- `kids_checkins` mantém histórico.
- Badges no `KidsAdmin` distinguem "Check-in ativo" vs "Aguardando check-in".

### 3.10 Comunicação Kids
- `kids_messages` com escopo segmentado: líder, professor, família.
- `KidsFamilyFeed` para pais.
- `kids-notify-whatsapp` edge function envia WhatsApp aos responsáveis.

### 3.11 Relatórios (KidsReports)
- Frequência da criança (`kids_child_attendance`).
- Desistência (`kids_report_dropoff`).
- Necessidades pontuais (`kids_report_needs`).
- Visitantes (`kids_report_visitors`).

### 3.12 Assistente de Inclusão (IA)
- Página `/kids/inclusao` — `KidsInclusionAssistant`.
- Usa Lovable AI Gateway (Gemini) via edge function `kids-inclusion-ai`.
- Sugere adaptações para crianças neurodivergentes ou com necessidades especiais.

### 3.13 Transferência de sala
- Aba dedicada + `kids_room_transfers` + `kids_transfer_child` RPC.

### 3.14 Contagem de voluntários
- `get_user_count` inclui criadores de página Kids, líderes Kids e teacher_rooms — refletidos no contador público da landing.

---

## 4. Segurança e privacidade

- **RLS habilitado** em todas as tabelas críticas; `GRANT` explícito na mesma migration.
- **Roles** em tabela separada (`user_roles`) — nunca no `profiles`; checagem via `has_role` `SECURITY DEFINER`.
- **Isolamento** por `is_department_member`, `is_kids_leader`, `is_kids_teacher_of_page`.
- **Views com mascaramento**:
  - `schedules_public` (mascara tokens/notas).
  - `churches_member_view` (mascara PII do registrante).
- **Colunas sensíveis** de `departments` (`invite_code`, `coordinator_invite_code`) revogadas de `authenticated`/`anon` — só via RPC `SECURITY DEFINER`.
- Todas as funções sensíveis com `SET search_path = public`.
- HIBP (k-anonymity) para checagem de senha vazada.
- `webauthn_challenges` de curta duração; credenciais isoladas por usuário.
- Auditoria: `billing_access_audit`, `profile_access_audit`, `login_logs`.
- Nenhuma foreign key de `public` para `auth.users`.

---

## 5. Stack técnica

- **Frontend**: React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + shadcn/ui.
- **Backend**: Supabase (via Lovable Cloud) — Postgres + Auth + Storage + Edge Functions Deno.
- **Roteamento**: React Router (43 rotas registradas).
- **i18n**: react-i18next (PT, EN, ES); `levi-language` em `localStorage`; `useDateLocale`.
- **AI**: Lovable AI Gateway (Gemini) para escala inteligente, inclusão Kids, smart-schedule Kids.
- **WhatsApp**: Z-API (`uazapi.ts`, `whatsapp-queue.ts`).
- **Pagamentos**: Stripe + Cakto.
- **PWA**: SW próprio + push handlers.

---

## 6. Rotas registradas (43)

`/`, `/admin-login`, `/admin`, `/admin/whatsapp-logs`, `/admin/voluntarios`, `/login`, `/entrar`, `/acessar`, `/auth`, `/join`, `/igreja/join/:code`, `/join/:inviteCode`, `/join-coordinator/:code`, `/confirm/:token`, `/.lovable/oauth/consent`, `/tutorial`, `/complete-profile`, `/dashboard`, `/departamento/:slug`, `/departments/:id`, `/departments/new`, `/novo-departamento`, `/my-schedules`, `/security`, `/payment`, `/apoio`, `/apoiar`, `/payment-success`, `/churches`, `/churches/:id`, `/church-setup`, **`/kids`**, **`/kids/join/:token`**, **`/kids/teacher-join/:token`**, **`/kids/checkin`**, **`/kids/dashboard`**, **`/kids/admin`**, **`/kids/inclusao`**, **`/kids/mensagens`**, **`/kids/relatorios`**, `/authorize-minor`, `/oauth/consent`, `*` (NotFound).

---

## 7. Regras invioláveis do produto

1. WhatsApp é o único canal de notificações — não adicionar push/e-mail/Telegram.
2. Registro é sempre por convite — nunca abrir cadastro aberto.
3. Cada tabela nova em `public` precisa de `GRANT` + `RLS` + policies na mesma migration.
4. Todo texto do produto usa `text-foreground` (dark-mode-safe); nunca hardcodar `text-white`/`bg-black`.
5. `LeviKidsWordmark` colorido em toda referência visível ao módulo Kids.
6. Ações administrativas viram modais/sheets — não subpáginas.
7. Nunca expor `invite_code` de departamentos a membros.
8. Sessão isolada por aba — não voltar para `localStorage`.
