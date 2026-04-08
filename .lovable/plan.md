## Plano: Disclaimer de responsabilidade, validação de CNPJ e dados do cadastrante

### Mudanças

**1. Adicionar campos "Responsável pelo cadastro" no formulário**

- Novo grupo de campos no topo: Nome do responsável, Email do responsável, Telefone do responsável
- Esses dados são apenas informativos (salvos no campo `description` ou em metadata) — o link continua sendo enviado apenas para o email da igreja
- Preencher automaticamente com os dados do perfil do usuário logado (se disponível)

**2. Validação de CNPJ real**

- Implementar validação algorítmica do CNPJ (dígitos verificadores) no schema Zod
- Máscara de formatação no input (XX.XXX.XXX/XXXX-XX)
- CNPJ obrigatório

**3. Disclaimer de responsabilidade**

- Adicionar um texto claro antes do botão de envio:
  > "Ao cadastrar, você declara que os dados fornecidos são verdadeiros. O LEVI não se responsabiliza por informações incorretas ou fornecidas por terceiros."
- Adicionar checkbox obrigatório de aceite dos termos

**4. Ajustar email enviado**

- O link continua sendo enviado **somente** para o email da igreja (já funciona assim)
- Incluir o nome do responsável pelo cadastro no email para referência

### Arquivos editados

- `src/pages/ChurchSetup.tsx` — novos campos, validação CNPJ, disclaimer com checkbox
- `supabase/functions/send-church-code-email/index.ts` — incluir nome do responsável no corpo do email

### Sem migration

Os dados do responsável já existem na tabela `profiles` do usuário logado. Nenhuma coluna nova necessária.