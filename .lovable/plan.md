

## Plano: Excluir Usuário Órfão

### Situação Atual

O email **elinosilva220@gmail.com** tem:
- Conta no sistema de autenticação (auth.users)
- Nenhum dado em tabelas do aplicativo (profiles, members, etc.)

### Ação Necessária

Para excluir completamente este usuário, é necessário removê-lo diretamente do sistema de autenticação através do backend:

### Passo a Passo

1. Acessar o gerenciamento de backend
2. Navegar até **Authentication > Users**
3. Localizar o usuário **elinosilva220@gmail.com**
4. Clicar no menu de opções (três pontos) e selecionar **Delete user**

### Acesso ao Backend

Clique no botão abaixo para acessar o gerenciamento de usuários:

### Após a Exclusão

O usuário poderá se cadastrar novamente normalmente usando o mesmo email.

### Alternativa: Corrigir em vez de Excluir

Se preferir manter a conta e apenas corrigir o perfil faltante, posso criar um plano para:
1. Inserir o registro de perfil manualmente via SQL
2. O usuário manteria a mesma conta e poderia fazer login normalmente

---

### Ação Recomendada

Como não há dados importantes associados, a exclusão é a opção mais limpa. O usuário poderá se recadastrar.

