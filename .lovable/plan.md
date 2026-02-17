

# Mural de Avisos do Lider

## O que sera implementado
O lider do departamento podera publicar avisos/comunicados que todos os membros do grupo verao ao acessar a pagina do departamento. Os avisos aparecerao em destaque, com data de publicacao e opcao de fixar avisos importantes.

## Como vai funcionar

**Para o lider:**
- Nova aba "Mural" no menu de acoes (ActionMenuContent)
- Tela para criar aviso com titulo, mensagem e opcao de fixar
- Poder editar ou excluir avisos existentes

**Para os membros:**
- Nova aba "Mural" nas tabs de navegacao (ao lado de Escalas e Disponibilidade)
- Lista de avisos do departamento, ordenados por fixados primeiro e depois por data
- Badge com contagem de avisos nao lidos

---

## Detalhes Tecnicos

### 1. Banco de Dados

Nova tabela `department_announcements`:

```sql
CREATE TABLE public.department_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_announcements ENABLE ROW LEVEL SECURITY;
```

Tabela para rastrear leitura:

```sql
CREATE TABLE public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES department_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
```

**Politicas RLS:**
- Membros do departamento podem ler avisos (SELECT)
- Lideres podem criar, editar e excluir avisos (ALL)
- Usuarios podem marcar seus proprios avisos como lidos (INSERT na reads)
- Usuarios podem ver suas proprias leituras (SELECT na reads)

### 2. Novos Componentes

- `src/components/department/AnnouncementBoard.tsx` - Componente principal com lista de avisos
- `src/components/department/CreateAnnouncementDialog.tsx` - Dialog para criar/editar aviso

### 3. Alteracoes em Arquivos Existentes

- `src/pages/Department.tsx` - Adicionar tab "Mural" e estado para controle
- `src/components/department/ActionMenuContent.tsx` - Adicionar botao "Mural" no menu do lider
- Membros verao a tab "Mural" na barra de tabs junto com Escalas e Disponibilidade

### 4. Fluxo de Uso

1. Lider acessa o menu de acoes e vai para a aba "Mural"
2. Clica em "Novo Aviso" e preenche titulo + mensagem
3. Opcionalmente marca como fixado (destaque permanente no topo)
4. Membros veem o aviso na aba "Mural" com badge de nao lido
5. Ao visualizar, o aviso e marcado como lido automaticamente

### 5. Interface

- Cards com titulo em destaque, conteudo e data de publicacao
- Avisos fixados com icone de pin e fundo diferenciado
- Badge numerico na tab "Mural" mostrando avisos nao lidos
- Botao de criar aviso flutuante (FAB) para lideres

