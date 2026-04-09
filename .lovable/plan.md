

## Plano: Permitir admin ver todas as igrejas

### Problema
A tabela `churches` tem RLS que restringe visualização apenas ao `leader_id` ou membros de departamentos. O admin global não tem política de acesso, por isso vê 0 igrejas.

### Solução
Adicionar uma política RLS que permite admins verem todas as igrejas.

### Mudanças

**1. Migration SQL**
```sql
CREATE POLICY "Admins can view all churches"
  ON public.churches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**2. (Opcional) Políticas para UPDATE/DELETE admin**
Se o admin também precisa editar/deletar igrejas que não criou (já existe `admin_delete_church` como function, mas o SELECT direto é bloqueado):
```sql
CREATE POLICY "Admins can manage all churches"
  ON public.churches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Nota
- Só existe 1 igreja no banco (Maranata Church), não 2. Se havia outra, pode ter sido removida pela função `cleanup-inactive-churches` (deleta igrejas sem departamentos após 5 dias).
- Nenhuma alteração de código necessária — só a política RLS.

### Arquivo
- **Migration**: nova política RLS na tabela `churches`

