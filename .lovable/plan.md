
# Portal Kids — Fase 1: Fundação Visual + PIN da Criança + Área dos Pais

Vou expandir o LeviKids atual (não criar app paralelo). O que já existe permanece funcionando; o redesign e as novas áreas se sobrepõem sobre as tabelas `kids_*` existentes.

## Escopo desta fase (aprovar aqui)

1. **Design system Portal Kids** — gradiente rosa/roxo/verde, cards pílula com glassmorphism, tipografia bold arredondada, gerando 4–6 ilustrações 3D base (mascote, ícones dos 4 perfis, medalha, versículo).
2. **Seletor de perfil** em `/kids` — 4 cards (Criança, Pai/Mãe, Professor, Líder) roteando cada perfil ao seu login.
3. **Login por PIN de 4 dígitos** para a criança (definido pelos pais no cadastro do filho).
4. **Área dos Pais** completa com todos os itens do escopo.
5. **Módulo Versículo do Dia** (transversal) + trilha de memorização com medalhas.

Áreas de **Professores** e **Líder ampliadas** ficam para as fases 2 e 3 (o LeviKids atual já cobre boa parte delas — vamos preservar e evoluir depois).

---

## 1. Design system

- `src/styles/portal-kids.css` com tokens: `--pk-grad-organic`, `--pk-pill-shadow`, `--pk-glow-*`, radius `rounded-[2rem]`.
- Componentes reutilizáveis: `<PillCard>`, `<ProfileCard>`, `<VerseCard>`, `<KidsButton>`, `<KidPinPad>`.
- Fontes: manter as atuais + peso 800 arredondado para títulos infantis.
- Ilustrações 3D geradas via imagegen (estilo Pixar/clay 3D): mascote LeviKids, 4 ícones de perfil, medalha estrela, ícone Bíblia aberta. Salvar em `src/assets/portal-kids/`.

## 2. Seletor de perfil

- Rota `/kids` vira a landing com os 4 cards.
- Se já autenticado com role conhecido, atalho "Continuar como [nome]".
- Roteia para: `/kids/child/login` (PIN), `/kids/parent/login`, `/kids/teacher/login`, `/kids/leader/login` (os 3 últimos reusam `/auth` com pré-seleção de perfil).

## 3. PIN da Criança

- Migration:
  - `kids_children`: add `pin_hash text`, `pin_set_at timestamptz`.
  - RPC `kids_set_child_pin(child_id uuid, pin text)` — só o guardian do filho pode setar; PIN 4 dígitos; hash via `crypt`.
  - RPC `kids_child_login(church_code text, child_name text, pin text)` → devolve token de sessão infantil de curta duração (JWT custom armazenado em sessionStorage, não confunde com auth Supabase dos adultos).
- Pais setam o PIN dentro da Área dos Pais → "Meus filhos" → "Definir PIN".
- Página `/kids/child` autenticada por esse token mostra: saudação, versículo do dia, jornada/medalhas, "meus versículos decorados".

## 4. Área dos Pais (`/kids/parent`)

Reusa `kids_guardians`, `kids_children`, `kids_checkins`.

- **Dashboard** `Olá, [Nome]!` com cards de filhos (foto, turma auto pela idade, status casa/igreja).
- **Check-in remoto**: gera QR/código numérico 6 dígitos por criança (nova tabela `kids_precheckin_codes`: `child_id, code, expires_at`). Professor lê o código na recepção e o RPC confirma o check-in vinculando ao adulto que trouxe.
- **Retirada segura**: nova tabela `kids_authorized_pickups` (`child_id, name, relationship, doc, photo_url`). No check-out o app pede seleção do autorizado.
- **Notificações em tempo real**: reusa `kids_messages` + Realtime; badge no bottom nav.
- **Pedido de oração**: nova tabela `kids_prayer_requests` (`child_id, guardian_id, text, status`) com status "estamos orando 🙏" alterável por líder.
- **Devocional família**: reusa banco de versículos (item 5) + campo `family_devotional_text` no versículo.
- **Agenda de eventos**: nova tabela `kids_events` (`title, starts_at, description, cover_url, allow_signup`) + `kids_event_signups`.
- **Histórico**: já temos `kids_checkins`; adicionar tela consolidada + medalhas.

**Bottom nav Pais**: Início · Meus Filhos · Agenda · Oração · Perfil.

## 5. Módulo Versículos + Jornada

- Tabelas:
  - `kids_verses` (`reference, text_simple, age_track enum('bercario','maternal','juniores','pre_ado'), illustration_url, audio_url, family_devotional_text, order_index, is_published`).
  - `kids_verse_memorized` (`child_id, verse_id, memorized_at`).
- Card "Versículo do dia" no topo das 4 áreas (mesmo componente `<VerseCard>`, escolhe por `age_track` quando aplicável).
- Botão "Decorei!" na área da criança → cria linha em `kids_verse_memorized`, dispara medalha.
- Trilha por faixa etária listada na área da criança e visível em progresso na área dos pais.
- Áudio narrado: campo `audio_url` (upload manual pelo líder por enquanto; TTS fica para fase futura).

## Segurança / RLS

- Todas as novas tabelas: RLS on + GRANT ao `authenticated` + `service_role`, sem `anon`.
- `kids_precheckin_codes`: leitura só pelo guardian dono e por professores escalados na sala da criança no dia; escrita só pelo guardian.
- `kids_authorized_pickups`: guardian gerencia, professor/líder leem.
- `kids_prayer_requests`: guardian dono + líderes da página.
- `kids_verse_memorized`: guardian do filho + próprio filho (via token infantil validado por RPC security definer) + líderes.
- PIN infantil: nunca em texto plano; RPC login retorna somente id/nome e assina token com secret do projeto.

## Detalhes técnicos

- **Token infantil**: Edge function `kids-child-auth` (Deno) valida PIN + emite JWT HS256 com `sub=child:<id>`, `exp=8h`. Guardado em `sessionStorage` sob chave separada. Um hook `useKidChildSession` gerencia.
- **Realtime** para notificações Pais: `ALTER PUBLICATION supabase_realtime ADD TABLE kids_messages, kids_prayer_requests;`.
- **Rotas novas**: `/kids/child/login`, `/kids/child`, `/kids/parent/login` (redir `/auth?profile=parent`), `/kids/parent`, `/kids/parent/filhos`, `/kids/parent/agenda`, `/kids/parent/oracao`, `/kids/parent/perfil`.
- **i18n**: PT-BR, tom caloroso com emojis (chaves em `pt.json` sob namespace `portalKids.*`).

## Entregáveis desta fase

- Migrations: PIN, pré-checkin, autorizados, orações, eventos, versículos, memorizados.
- Edge function `kids-child-auth`.
- Design system + 6 ilustrações 3D geradas.
- Seletor de perfil, login PIN, Área da Criança (versículo + jornada), Área dos Pais completa.
- Bottom nav do perfil Pais.

## Fora desta fase (fases 2 e 3, planos separados depois)

- Redesign visual das áreas Líder e Professor com o novo estilo.
- Novos recursos da Área do Professor (plano de aula, chat da equipe, observações).
- Novos recursos da Área do Líder (aprovação de conteúdo, central de avisos push, config avançada de igreja).
- Push notifications reais (hoje já usamos WhatsApp/Realtime).

Quer aprovar assim ou ajustar o recorte da fase 1?
