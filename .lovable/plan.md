
## Popup de Avisos em Qualquer Pagina

### O que muda
Atualmente o popup de avisos so aparece na pagina do departamento. Com essa mudanca, ele aparecera na **primeira pagina protegida** que o usuario abrir -- seja Dashboard, Minhas Escalas, ou a pagina do departamento.

### Como funciona
1. O componente `AnnouncementPopup` sera movido para dentro do `ProtectedRoute`, que envolve todas as paginas autenticadas
2. Em vez de receber um unico `departmentId`, o componente buscara **todos os departamentos** do usuario (como lider ou membro)
3. Verificara avisos recentes de todos esses departamentos de uma vez
4. A logica de localStorage (3 horas) continua igual -- se o aviso ja foi visto, nao aparece de novo independente da pagina

### Comportamento esperado
- Usuario abre "Minhas Escalas" -> popup aparece com avisos pendentes
- Usuario abre "Dashboard" -> popup aparece com avisos pendentes
- Usuario abre departamento -> popup aparece (como ja funciona)
- Se ja viu o aviso em uma pagina, nao aparece novamente em outra

### Secao Tecnica

**Componente `AnnouncementPopup.tsx` -- alteracoes:**
- Remover prop `departmentId` obrigatorio
- Adicionar prop opcional `departmentId` (quando ja se sabe o departamento)
- Se nao receber `departmentId`, buscar todos os departamentos do usuario via tabela `members` + `departments` (onde e lider)
- Buscar avisos de todos esses departamentos de uma vez
- Adicionar o nome do departamento no popup para contexto ("Aviso do [nome do departamento]")

**`ProtectedRoute.tsx` -- alteracoes:**
- Importar e renderizar `AnnouncementPopup` apos a verificacao de sessao
- Passar apenas `currentUserId` (o componente busca os departamentos sozinho)

**`Department.tsx` -- alteracoes:**
- Remover o `AnnouncementPopup` daqui (ja que esta no ProtectedRoute, evita duplicacao)

**Arquivos alterados:**
- `src/components/department/AnnouncementPopup.tsx` (buscar departamentos automaticamente)
- `src/components/ProtectedRoute.tsx` (adicionar o popup)
- `src/pages/Department.tsx` (remover popup duplicado)
