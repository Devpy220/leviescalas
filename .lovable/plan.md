

## Plano: Adicionar Cicero Pereira ao Departamento Estacionamento

### Dados Identificados

| Item | Valor |
|------|-------|
| **Usuário** | Cicero Pereira |
| **Email** | elinosilva220@gmail.com |
| **User ID** | `1994e487-8537-488d-81a7-d873c34500b5` |
| **Departamento** | Estacionamento |
| **Department ID** | `9eda4d80-a0f1-4a1f-9620-c511d9abf0ac` |

### Ação Necessária

Inserir um registro na tabela `members` para associar o usuário ao departamento com o papel de "member" (membro comum).

### SQL a Executar

```text
INSERT INTO members (department_id, user_id, role)
VALUES (
  '9eda4d80-a0f1-4a1f-9620-c511d9abf0ac',
  '1994e487-8537-488d-81a7-d873c34500b5',
  'member'
);
```

### Resultado Esperado

Após a inserção:
- Cicero Pereira terá acesso ao departamento Estacionamento
- Poderá visualizar as escalas do departamento
- Poderá marcar sua disponibilidade
- Aparecerá na lista de membros do departamento (atualmente com 13 membros, passará a ter 14)

### Detalhes Técnicos

A tabela `members` possui as seguintes colunas relevantes:
- `department_id`: UUID do departamento
- `user_id`: UUID do usuário
- `role`: Papel do membro (`member` ou `leader`)
- `joined_at`: Data de entrada (preenchida automaticamente)

