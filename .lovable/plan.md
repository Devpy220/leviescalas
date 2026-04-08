## Plano: Cadastro de igrejas self-service com auto-exclusão

### Resumo

Permitir que qualquer usuário cadastre sua igreja. Após o cadastro, enviar um email para o email da igreja com um link para criar departamentos (não mais o código). Igrejas sem nenhum departamento criado em 5 dias são excluídas automaticamente.

### Mudanças

**1. Tornar `/church-setup` público (sem restrição de admin)**

- Remover a aba "Entrar com código" — agora só terá o formulário de cadastro de igreja
- Qualquer usuário autenticado pode cadastrar (redirecionar para `/auth` se não logado)
- Após cadastro, mostrar dialog de sucesso com mensagem explicativa
- colocar cadastrar sua Igreja separado do entrar e deixar o fale conosco  

**2. Atualizar email enviado (`send-church-code-email`)**

- Remover a restrição de admin (qualquer criador pode disparar)
- Mudar o conteúdo do email:
  - Link direto para `/departments/new?churchCode=CODIGO` em vez de apenas o código
  - Explicar que o link serve para **criar departamentos/ministérios**
  - Informar que dentro do departamento haverá um link para convidar voluntários
  - Avisar que se nenhum departamento for criado em 5 dias, a igreja será excluída

**3. Mensagem explicativa na página de criar departamento (`CreateDepartment.tsx`)**

- Adicionar um card/alerta no topo explicando:
  - "Aqui você cria os departamentos/ministérios da sua igreja"
  - "Após criar, você receberá um link de convite para adicionar voluntários"

**4. Edge Function de limpeza automática (`cleanup-inactive-churches`)**

- Nova Edge Function que roda via cron (1x por dia)
- Query: igrejas criadas há mais de 5 dias SEM nenhum departamento vinculado
- Deletar essas igrejas automaticamente
- Configurar cron job com `pg_cron` para executar diariamente

**5. Adicionar link para `/church-setup` na Landing page**

- Botão "Cadastrar minha Igreja" visível na landing

### Detalhes técnicos

- **Migration**: nenhuma (tabelas já existem)
- **Edge Function nova**: `supabase/functions/cleanup-inactive-churches/index.ts`
- **Cron job**: `cron.schedule('cleanup-churches', '0 3 * * *', ...)` — roda às 3h da manhã
- **Arquivos editados**: `ChurchSetup.tsx`, `CreateDepartment.tsx`, `Landing.tsx`, `send-church-code-email/index.ts`
- **Config**: adicionar `cleanup-inactive-churches` ao `config.toml` com `verify_jwt = false`