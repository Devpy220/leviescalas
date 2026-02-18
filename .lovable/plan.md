

## Rastreamento de Logins no Painel Admin

### O que sera feito
Adicionar ao painel administrativo um novo grafico e contadores mostrando:
- Quem logou no sistema
- Em quais horarios
- Quantas vezes por dia, semana e mes
- Lista dos ultimos logins com nome, email e horario

### Etapas

**1. Criar tabela `login_logs` no banco de dados**
- Colunas: `id`, `user_id`, `logged_in_at`, `user_agent`
- RLS: inserção pelo proprio usuario, leitura apenas por admins
- Sem foreign key para auth.users (seguindo o padrao do projeto)

**2. Registrar logins automaticamente**
- No hook `useAuth.tsx`, ao detectar evento `SIGNED_IN` no `onAuthStateChange`, inserir um registro na tabela `login_logs`
- Registro silencioso (nao bloqueia o fluxo do usuario)

**3. Atualizar a Edge Function `get-analytics`**
- Buscar dados da tabela `login_logs` dos ultimos 30 dias
- Agrupar por dia para gerar grafico
- Calcular totais: logins hoje, esta semana, este mes
- Retornar lista dos ultimos 50 logins com nome do usuario (via join com profiles)

**4. Adicionar secao de Analytics de Login no Admin**
- Novos contadores: "Logins Hoje", "Logins Esta Semana", "Logins Este Mes"
- Grafico de area mostrando logins por dia (ultimos 30 dias)
- Tabela com os ultimos logins mostrando: Nome, Email, Horario, Dispositivo

### Secao Tecnica

Estrutura da tabela:
```text
login_logs
  - id: uuid (PK, default gen_random_uuid())
  - user_id: uuid (NOT NULL)
  - logged_in_at: timestamptz (default now())
  - user_agent: text (nullable)
```

RLS policies:
- INSERT: `auth.uid() = user_id` (usuario insere seu proprio log)
- SELECT: apenas admins via `has_role(auth.uid(), 'admin')`

Arquivos alterados:
- Nova migration SQL (tabela + RLS)
- `src/hooks/useAuth.tsx` - inserir log no SIGNED_IN
- `supabase/functions/get-analytics/index.ts` - buscar e retornar dados de login
- `src/pages/Admin.tsx` - novos graficos e tabela de logins
