## O que vamos entregar

### 1. Link único da igreja (`/igreja/join/CODIGO`)

Quem cadastra a igreja passa a receber **um único link universal** (baseado no `code` da igreja). Esse link substitui a comunicação atual de "código separado".

Ao abrir o link:

- Se não estiver logado → manda pra `/auth` e volta pra esse link após login/cadastro.
- Se estiver logado → mostra uma tela com **2 cards de escolha**:
  - **Criar Departamento** (louvor, mídia, recepção, etc.) — leva para `/departments/new?churchCode=XXXX` (fluxo atual, já funciona).
  - **Criar Página LeviKids** — cria a página LeviKids da igreja e leva direto para `/kids/admin`.
  - Colocar um aviso ao escolher a pagina do levikids que é uma pagina por igreja.
    - Só aparece se a igreja **ainda não tiver** uma página LeviKids (1 por igreja).
    - Se já existir, o card fica desabilitado com aviso "Esta igreja já tem uma página LeviKids".

O usuário que criar a página LeviKids vira automaticamente **líder daquela página** (registro em `kids_leaders`), independente de ser ou não o líder da igreja.

### 2. Onde o link aparece

- **ChurchSetup** (tela pós-cadastro da igreja): mostrar o link universal `https://leviescalas.com.br/igreja/join/CODIGO` com botão "Copiar" e "Compartilhar no WhatsApp", substituindo a apresentação atual do código solto.
- **Dashboard**: card da igreja passa a exibir esse link pro líder poder recompartilhar quando quiser.

### 3. Corrigir acesso ao LeviKids

Hoje a validação que adicionamos bloqueia o líder da igreja de abrir `/kids` mesmo quando a página LeviKids existe. Ajuste:

- `userHasKidsAccess` volta a considerar acesso quando existe uma `kids_pages` da igreja onde o usuário é líder OU está em `kids_leaders`.
- Continua **não** liberando acesso a quem só cadastrou a igreja e não tem página LeviKids criada — isso mantém a regra que você pediu antes ("cadastrar igreja não dá acesso ao LeviKids").
- quero que apenas o lider da igreja, o lider  que criou a pagina, e os professores que ele add podem ter acessoa pagina no levikids de cada igreja
- então automatico o responsavel pela igreja ao cadastrar uma igreja, vira uma conta, tem que colocar senha e email para ele logar depois 

Com isso, quando Amelia (ou quem for) criar a página LeviKids pelo link universal, o botão LeviKids do dashboard abre normalmente e mostra a `KidsAdmin` com salas, QR e convites de professor (a página `KidsAdmin` já tem tudo isso — só não estava sendo alcançada por causa do bloqueio).

### 4. LeviKids: garantir salas por idade, QR e convite de professores

A `KidsAdmin` já tem:

- Criação de sala com `age_min` / `age_max` e `is_inclusion`.
- Geração e download de QR/PDF para cada sala e para a página.
- Convite de líder Kids e professor por e-mail, e link público de auto-cadastro de professor via `/kids/teacher/join?...`.

Vamos revisar a tela para deixar essas 3 ações **visíveis logo no topo** (hoje algumas estão em abas), com botões grandes: "Nova Sala", "Baixar QR da Sala", "Convidar Professor".

## Detalhes técnicos

- Nova rota: `/igreja/join/:code` → componente `ChurchJoinHub.tsx`.
  - Usa `validate_church_code_secure` pra achar a igreja.
  - Consulta `kids_pages` por `church_id` pra decidir se libera o card LeviKids.
- Nova função de criação de página: pode usar insert direto em `kids_pages` (RLS já permite via `created_by`/church leader) OU nova RPC `kids_create_page_for_church(_church_id, _name)` que também insere o `kids_leaders` do criador. Preferimos a RPC pra garantir atomicidade.
- `src/lib/kidsAccess.ts`: adicionar de volta a checagem "é líder de igreja que tem `kids_pages`", mantendo o restante.
- `ChurchSetup.tsx` e `Dashboard.tsx`: exibir o novo link universal.
- `KidsAdmin.tsx`: reorganizar cabeçalho com CTAs de sala/QR/professor.

## Migração SQL necessária

- `kids_create_page_for_church(_church_id uuid, _name text)` — SECURITY DEFINER, valida que quem chama é líder da igreja ou tem o código, cria `kids_pages` + `kids_leaders` do criador em uma transação. Bloqueia se já existir página pra essa igreja.
- (Opcional) `get_church_kids_page_id(_church_id uuid)` pra o hub decidir habilitar/desabilitar o card sem expor dados.
  &nbsp;

Se aprovar, começo pela migração e depois faço o front.