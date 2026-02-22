

## Vincular Diego Castelo ao departamento Intercessão

### Diagnóstico
- **Usuário**: Diego Castelo (`diegocsatelo82@gmail.com`) - ID: `6f62263d-fbbf-49e2-ad55-da0281475e88`
- **Departamento**: Intercessão - ID: `14c94509-cf9d-488f-b97f-e5b1b3ff1b1b`
- **Igreja**: Maranata Church

### Ação
Inserir um registro na tabela `members` para vincular o usuário ao departamento como membro, e atualizar o campo `invited_by_department_id` no perfil.

### Detalhes técnicos
1. Inserir na tabela `members`:
   - `department_id`: `14c94509-cf9d-488f-b97f-e5b1b3ff1b1b`
   - `user_id`: `6f62263d-fbbf-49e2-ad55-da0281475e88`
   - `role`: `member`

2. Atualizar `profiles` para registrar a origem:
   - `invited_by_department_id`: `14c94509-cf9d-488f-b97f-e5b1b3ff1b1b`

